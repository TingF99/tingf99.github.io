// === 設定區 ===
// 員工操作需驗證的密碼 (請自行修改)
const STAFF_KEY = "fake"; 

// === 核心功能與資料結構 (Queue 實作) ===
function getQueue() {
  var props = PropertiesService.getScriptProperties();
  var queueStr = props.getProperty('queue');
  return queueStr ? JSON.parse(queueStr) : [];
}

function saveQueue(queue) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('queue', JSON.stringify(queue));
}

function getNextId() {
  var props = PropertiesService.getScriptProperties();
  var id = parseInt(props.getProperty('next_id') || '1');
  props.setProperty('next_id', (id + 1).toString());
  return id;
}

function logEvent(event) {
  var props = PropertiesService.getScriptProperties();
  var logs = props.getProperty('logs');
  logs = logs ? JSON.parse(logs) : [];
  event.timestamp = new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'});
  logs.unshift(event);
  if (logs.length > 40) logs.pop();
  props.setProperty('logs', JSON.stringify(logs));
}

// === API 路由路由處理 ===
function doGet(e) {
  var action = e.parameter.action;
  
  if (action === 'count') {
    var q = getQueue();
    var waiting = q.filter(function(item) { return item.status === 'waiting' || item.status === 'notified'; }).length;
    return ContentService.createTextOutput(JSON.stringify({ waiting: waiting }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'status') {
    var id = parseInt(e.parameter.id);
    var q = getQueue();
    var pos = 0;
    var found = false;
    var status = 'unknown';
    
    for (var i = 0; i < q.length; i++) {
      if (q[i].status === 'waiting' || q[i].status === 'notified') {
        if (q[i].id === id) {
          found = true;
          status = q[i].status;
          break;
        }
        pos++;
      }
    }
    
    if (found) {
      return ContentService.createTextOutput(JSON.stringify({ status: status, ahead: pos }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ error: "找不到該號碼，可能已入座或取消" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // 員工專用 (需密碼)
  var key = e.parameter.key;
  if (key !== STAFF_KEY) {
    return ContentService.createTextOutput(JSON.stringify({ error: "未授權" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'queue') {
    return ContentService.createTextOutput(JSON.stringify({ queue: getQueue() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'log') {
    var props = PropertiesService.getScriptProperties();
    var logs = props.getProperty('logs');
    return ContentService.createTextOutput(logs || '[]')
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'reset') {
    PropertiesService.getScriptProperties().deleteAll();
    return ContentService.createTextOutput(JSON.stringify({ success: "資料已清空" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ error: "無效的 action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ error: "無效的 JSON 資料" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var action = data.action;
  var q = getQueue();
  
  if (action === 'join') {
    // 檢查容量限制 (PropertiesService 限制，約50組)
    var activeCount = q.filter(function(item) { return item.status !== 'seated' && item.status !== 'cancelled'; }).length;
    if (activeCount >= 40) {
      return ContentService.createTextOutput(JSON.stringify({ error: "候位已滿，請稍後再試" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var id = getNextId();
    var now = new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'});
    var newItem = {
      id: id,
      name: data.name,
      gender: data.gender,
      email: data.email,
      party_size: data.party_size,
      status: 'waiting',
      created_at: now,
      notified_at: ''
    };
    q.push(newItem);
    saveQueue(q);
    
    var pos = q.filter(function(item) { return item.status === 'waiting' || item.status === 'notified'; }).length - 1;
    logEvent({ type: 'join', msg: data.name + ' 取號 ' + id });
    
    return ContentService.createTextOutput(JSON.stringify({ id: id, ahead: pos }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // 顧客自行取消 (加分功能 F9)
  if (action === 'leave') {
    var targetId = parseInt(data.id);
    for (var i = 0; i < q.length; i++) {
      if (q[i].id === targetId && (q[i].status === 'waiting' || q[i].status === 'notified')) {
        q[i].status = 'cancelled';
        saveQueue(q);
        logEvent({ type: 'leave', msg: q[i].name + ' 自行取消候位' });
        return ContentService.createTextOutput(JSON.stringify({ success: "已取消候位" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ error: "無法取消" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // 員工專用 POST 操作
  if (data.key !== STAFF_KEY) {
    return ContentService.createTextOutput(JSON.stringify({ error: "未授權" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var targetId = parseInt(data.id);
  var targetIndex = -1;
  for (var i = 0; i < q.length; i++) {
    if (q[i].id === targetId) {
      targetIndex = i;
      break;
    }
  }
  
  if (targetIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ error: "找不到資料" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'notify') {
    if (q[targetIndex].status === 'notified') {
       return ContentService.createTextOutput(JSON.stringify({ error: "已通知過" })).setMimeType(ContentService.MimeType.JSON);
    }
    q[targetIndex].status = 'notified';
    q[targetIndex].notified_at = new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'});
    saveQueue(q);
    logEvent({ type: 'notify', msg: '通知號碼 ' + targetId });
    
    // 呼叫 Gmail 寄信
    try {
      MailApp.sendEmail({
        to: q[targetIndex].email,
        subject: "【海大餐廳】您的候位通知",
        htmlBody: "<h3>您好 " + q[targetIndex].name + " " + q[targetIndex].gender + "，</h3><p>您的候位號碼 <b>" + targetId + "</b> 已經快到了！請盡速至餐廳櫃檯報到。</p>"
      });
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ success: "狀態已更新，但寄信失敗" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: "已寄送通知" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'seat') {
    var name = q[targetIndex].name;
    q[targetIndex].status = 'seated'; // 標記為已入座，脫離候位隊伍
    saveQueue(q);
    logEvent({ type: 'seat', msg: '安排 ' + name + ' 入座' });
    return ContentService.createTextOutput(JSON.stringify({ success: "已安排入座" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'cancel') {
    var name = q[targetIndex].name;
    q[targetIndex].status = 'cancelled';
    saveQueue(q);
    logEvent({ type: 'cancel', msg: '員工取消 ' + name + ' 候位' });
    return ContentService.createTextOutput(JSON.stringify({ success: "已取消該組" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ error: "無效的操作" }))
    .setMimeType(ContentService.MimeType.JSON);
}