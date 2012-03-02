var Engine = function(server, options) {
    this._server  = server;
    console.log(this._server);
    this._options = options || {};

    this._clients   = {};
    this._channels  = {};
    this._messages  = {};
    this._queues = {};

    host   = this._options.host     || 'localhost',
    port   = this._options.port     || '5672',
    this._exchange = this._options.exchange || 'amq.topic',
    user   = this._options.user,
    auth   = this._options.password;

    this._conn;

};

Engine.create = function(server, options) {
  return new this(server, options);
};

Engine.prototype = {
  createClient: function(callback, context) {
    
    this.getAmqpClient(function(conn) {
        console.log("====Connection======");
        console.log(conn);
        self = this;
        var q = conn.queue('',function (queue) {
                console.log("====QUEUE======");
                console.log(queue);
                queue.subscribe(function (message, headers, deliveryInfo) {
                    self._server.debug('Received message ? to channel ?', this.name, deliveryInfo.routingKey);
                });
                var clientId = queue.name;
                self._server.debug('Created new client ?', clientId);
                self.ping(clientId);
                self._server.trigger('handshake', clientId);
                callback.call(context, clientId);
        });
    });    
  },
  
  getAmqpClient: function(callback) {
    if(typeof this._conn === "undefined") {
        var amqp = require('amqp');
        try {
        this._conn = amqp.createConnection(
            {url: "amqp://" + host + ":" + port, defaultExchangeName: this._exchange}).
            on('ready', function() {
                callback(this);
            });
        } catch(error) {
            console.log(error);
        }
    } else {
        callback(this._conn);
    }
  },
  
  destroyClient: function(clientId, callback, context) {
    //if (!this._namespace.exists(clientId)) return;
    var clients = this._clients;
    
    if (clients[clientId])
      clients[clientId].forEach(function(channel) { this.unsubscribe(clientId, channel) }, this);
    
    this.removeTimeout(clientId);
    //this._namespace.release(clientId);
    delete this._messages[clientId];
    this._server.debug('Destroyed client ?', clientId);
    this._server.trigger('disconnect', clientId);
    if (callback) callback.call(context);
  },
  
  clientExists: function(clientId, callback, context) {
    callback.call(context, this._namespace.exists(clientId));
  },
  
  ping: function(clientId) {
    var timeout = this._server.timeout;
    if (typeof timeout !== 'number') return;
    
    this._server.debug('Ping ?, ?', clientId, timeout);
    /*
    this.removeTimeout(clientId);
    this.addTimeout(clientId, 2 * timeout, function() {
      this.destroyClient(clientId);
    }, this);
    */
  },
  
  subscribe: function(clientId, channel, callback, context) {
    var clients = this._clients, 
    channels = this._channels;
    
    clients[clientId] = clients[clientId] || new Faye.Set();
    var trigger = clients[clientId].add(channel);
    
    channels[channel] = channels[channel] || new Faye.Set();
    channels[channel].add(clientId);
    
    for (var i = 0, n = queues.length; i < n; i++) {
        var queue = queues[i];
        if(queue.name == clientId) {
            queue.bind(this._exchange, channel);
        }
    }
    
    this._server.debug('Subscribed client ? to channel ?', clientId, channel);
    if (trigger) this._server.trigger('subscribe', clientId, channel);
    if (callback) callback.call(context, true);
  },
  
  unsubscribe: function(clientId, channel, callback, context) {
    var clients  = this._clients,
        channels = this._channels,
        trigger  = false;
    
    if (clients[clientId]) {
      trigger = clients[clientId].remove(channel);
      if (clients[clientId].isEmpty()) delete clients[clientId];
    }
    
    if (channels[channel]) {
      channels[channel].remove(clientId);
      if (channels[channel].isEmpty()) delete channels[channel];
    }
    
    for (var i = 0, n = queues.length; i < n; i++) {
        var queue = queues[i];
        if(queue.name == clientId) {
            queue.unbind(this._exchange, channel);
        }
    }
    
    this._server.debug('Unsubscribed client ? from channel ?', clientId, channel);
    if (trigger) this._server.trigger('unsubscribe', clientId, channel);
    if (callback) callback.call(context, true);
  },
  
  publish: function(message, channels) {
    this._server.debug('Publishing message ?', message);

    var messages = this._messages,
        clients  = new Faye.Set(),
        subs;
    
    for (var i = 0, n = channels.length; i < n; i++) {
      subs = this._channels[channels[i]];
      if (!subs) continue;
      subs.forEach(clients.add, clients);
    }
    
    clients.forEach(function(clientId) {
      this._server.debug('Queueing for client ?: ?', clientId, message);
      messages[clientId] = messages[clientId] || [];
      messages[clientId].push(Faye.copyObject(message));
      this.emptyQueue(clientId);
    }, this);
    
    this._server.trigger('publish', message.clientId, message.channel, message.data);
  },
  
  emptyQueue: function(clientId) {
    if (!this._server.hasConnection(clientId)) return;
    this._server.deliver(clientId, this._messages[clientId]);
    delete this._messages[clientId];
  },
  
  // Helper methods specific to AMQP Engine
  toAmqpChannel: function(bayeuxChannel) {
    if(typeof bayeuxChannel !== "string") return;
    // Remove the leading slash
    if(bayeuxChannel.charAt(0) === '/') bayeuxChannel = bayeuxChannel.slice(1);
    
    bayeuxChannel = bayeuxChannel.replace('/','.');
    bayeuxChannel = bayeuxChannel.replace('**','*.#');
    return bayeuxChannel
  }
  
};
//Faye.extend(Engine.prototype, Faye.Timeouts);
module.exports = Engine;