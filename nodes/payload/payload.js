var utils = require('../../lib/utils.js');

module.exports = function(RED) {
  function buildArgs(payload, ...keys) {
    var values = [];
    var n = keys.length;

    for (var i = 0; i < n; i++) {
      values.push(payload[keys[i]]);
      delete payload[keys[i]];
    }

    return [...values, payload];
  }

  function PayloadNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    // Get base configuration
    this.bot = RED.nodes.getNode(config.bot);
    this.chatId = parseInt(config.chatId);
    this.sendMethod = config.sendMethod;
    this.staticPayload = config.payload;

    // Initialize bot
    utils.initializeBot(node);

    // Verify inputs
    if (isNaN(this.chatId)) {
      this.chatId = null;
    }

    if (this.staticPayload && typeof this.staticPayload !== "object") {
      try {
        this.staticPayload = JSON.parse(this.staticPayload);
      } catch(ex) {
        utils.updateNodeStatusFailed(node, "staticPayload is not valid JSON");
        node.warn(ex.message);
        return;
      }
    }

    this.on("input", function(msg){
      if (!(node.staticPayload || msg.payload)) {
        utils.updateNodeStatusFailed(node, "message payload is empty");
        return;
      }

      if (!utils.validateChatId(node, msg)) {
        utils.updateNodeStatusFailed(node, "message has no chatID");
        return;
      }

      if (!node.sendMethod && !msg.method) {
        utils.updateNodeStatusFailed(node, "sendMethod is empty");
        return;
      }

      if (msg.method && typeof node.telegramBot[msg.method] !== "function") {
        utils.updateNodeStatusFailed(node, "sendMethod is not a valid method");
        return;
      }

      var chatId = node.chatId || msg.telegram.chat.id;
      var sendMethod = node.sendMethod || msg.method;
      var payload = node.staticPayload;
      var args = [];

      if (!payload && msg.payload) {
        if (typeof msg.payload === "string") {
          try {
            payload = JSON.parse(msg.payload);
          } catch(ex) {
            utils.updateNodeStatusFailed(node, "payload is malformed");
            node.warn(ex.message);
          }
        } else if (typeof msg.payload === "object") {
          payload = msg.payload;
        } else {
          utils.updateNodeStatusFailed(node, "payload is malformed");
          node.warn(`expected payload to be string or object, got ${typeof msg.payload}`);
          return;
        }
      } else {
        try {
          payload = JSON.parse(JSON.stringify(payload));
        } catch (ex) {
          utils.updateNodeStatusFailed(node, "payload is malformed");
          node.warn(ex.message);
        }
      }

      payload.chat_id = chatId;

      switch(sendMethod) {
        case "sendMessage":    args = buildArgs(payload, "chat_id", "text"); break;
        case "sendPhoto":      args = buildArgs(payload, "chat_id", "photo"); break;
        case "sendAudio":      args = buildArgs(payload, "chat_id", "audio"); break;
        case "sendDocument":   args = buildArgs(payload, "chat_id", "document"); break;
        case "sendSticker":    args = buildArgs(payload, "chat_id", "sticker"); break;
        case "sendVideo":      args = buildArgs(payload, "chat_id", "video"); break;
        case "sendVoice":      args = buildArgs(payload, "chat_id", "voice"); break;
        case "sendVideoNote":  args = buildArgs(payload, "chat_id", "video_note"); break;
        case "sendMediaGroup": args = buildArgs(payload, "chat_id", "media"); break;
        case "sendLocation":   args = buildArgs(payload, "chat_id", "latitude", "longitude"); break;
        case "sendVenue":      args = buildArgs(payload, "chat_id", "latitude", "longitude", "title", "address"); break;
        case "sendContact":    args = buildArgs(payload, "chat_id", "phone_number", "first_name"); break;
        case "sendChatAction": args = buildArgs(payload, "chat_id", "chat_action"); break;

        case "answerCallbackQuery":     args = buildArgs(payload, "chat_id", "callback_query_id"); break;
        case "editMessageText":         args = buildArgs(payload, "text"); break;
        case "editMessageCaption":      args = buildArgs(payload, "caption"); break;
        case "editMessageReplyMarkup":  args = buildArgs(payload, "reply_markup"); break;
        case "editMessageLiveLocation": args = buildArgs(payload, "latitude", "longitude"); break;
        case "stopMessageLiveLocation": args = buildArgs(payload); break;
        
        default: node.warn("unsupported send method:" + sendMethod);
      }

      if (args.length > 0) {
        node.telegramBot[sendMethod](...args).then(function(response){
          msg.payload = response;
          node.send(msg);
        });
      } else {
        node.warn("empty arguments after parsing payload");
      }
    });

    this.on("close", function(){
      node.telegramBot.off("message");
      node.status({});
    });
  }

  RED.nodes.registerType("telegrambot-payload", PayloadNode);
};
