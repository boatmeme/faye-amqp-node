var Engine = function(server, options) {
    this._amqp = require('amqp');
    this._server    = server;
    this._options   = options || {};
    this._namespace = new Faye.Namespace();
    this._clients   = {};
    this._channels  = {};
    this._messages  = {};

    host   = this._options.host     || 'localhost',
    port   = this._options.port     || '5672',
    this._exchangeName = this._options.exchangeName || 'faye',
    user   = this._options.user,
    auth   = this._options.password;
    
    this._url = "amqp://" + host + ":" + port;

    this._conn;
    this._queue;
    this._exchange;

};

Engine.create = function(server, options) {
  return new this(server, options);
};

Engine.prototype = {
    createClient: function(callback, context) {
        //console.log("called createClient");
        var clientId = this._namespace.generate();
        this._server.debug('Created new client ?', clientId);
        this.ping(clientId);
        this._server.trigger('handshake', clientId);
        callback.call(context, clientId);
    },
  
    getAmqpClient: function(callback) {
        self = this;
        if(typeof this._conn === "undefined") {
            this._amqp.createConnection({url: self._url, defaultExchangeName: self._exchangeName}).
                on('ready', function() {
                    self._conn = this;
                    self._server.debug('Connected to AMQP Server ?', this._url);
                    self._conn.exchange(self._exchangeName,{type: 'fanout'}, function(exchange) {
                        self._exchange = exchange;
                        self._conn.queue('',function (queue) {
                            //console.log("====QUEUE======");
                            //console.log(queue);
                            
                            // Catch all messages
                            queue.bind(self._exchangeName, '');
                            queue.subscribe(function (amqpMessage, headers, deliveryInfo) {
                                self._server.debug('Received message ? to channel ?', amqpMessage.fayeMessage, amqpMessage.fayeChannels);
                                self.unpackMessage(amqpMessage.fayeMessage, amqpMessage.fayeChannels);
                            });
                            self._queue = queue;
                            callback.call(self._conn);

                        });
                   });
                });        
        } else {
            callback(this._conn);
        }
    },

    disconnect: function() {
        //console.log("Called disconnect");
        /*
        if(typeof this._conn !== 'undefined') {
            this._conn.end();
            this._conn = undefined;
        }
        */
    },
  
   destroyClient: function(clientId, callback, context) {
      //console.log("Called destroyClient");
      if (!this._namespace.exists(clientId)) return;
      var clients = this._clients;
      
      if (clients[clientId])
        clients[clientId].forEach(function(channel) { this.unsubscribe(clientId, channel) }, this);
      
      this.removeTimeout(clientId);
      this._namespace.release(clientId);
      delete this._messages[clientId];
      this._server.debug('Destroyed client ?', clientId);
      this._server.trigger('disconnect', clientId);
      if (callback) callback.call(context);
    },
    
    clientExists: function(clientId, callback, context) {
      //console.log("Called clientExists");
      callback.call(context, this._namespace.exists(clientId));
    },
    
    ping: function(clientId) {
      //console.log("Called ping");
      var timeout = this._server.timeout;
      if (typeof timeout !== 'number') return;
      
      this._server.debug('Ping ?, ?', clientId, timeout);
      this.removeTimeout(clientId);
      this.addTimeout(clientId, 2 * timeout, function() {
        this.destroyClient(clientId);
      }, this);
    },
    
    subscribe: function(clientId, channel, callback, context) {
      //console.log("Called subscribe");
      var clients = this._clients, channels = this._channels;
      
      clients[clientId] = clients[clientId] || new Faye.Set();
      var trigger = clients[clientId].add(channel);
      
      channels[channel] = channels[channel] || new Faye.Set();
      channels[channel].add(clientId);
      
      this._server.debug('Subscribed client ? to channel ?', clientId, channel);
      if (trigger) this._server.trigger('subscribe', clientId, channel);
      if (callback) callback.call(context, true);
    },
    
    unsubscribe: function(clientId, channel, callback, context) {
      //console.log("Called unsubscribe");
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
      
      this._server.debug('Unsubscribed client ? from channel ?', clientId, channel);
      if (trigger) this._server.trigger('unsubscribe', clientId, channel);
      if (callback) callback.call(context, true);
    },
    
    publish: function(message, channels) {
      //console.log("Called publish");
      this._server.debug('Publishing message ?', message);
      self = this;
      
      
        this.getAmqpClient(function(conn) { 
            var transportMessage = {fayeMessage: message, fayeChannels:channels};
            self._exchange.publish('',transportMessage,{});
            console.log("Published: " + JSON.stringify(transportMessage));
            self._server.trigger('publish', message.clientId, message.channel, message.data);
        });
      
    },
    
    unpackMessage: function(message, channels) {
        //console.log(JSON.stringify(message));
        //console.log(JSON.stringify(channels));
        
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
    },
    
    emptyQueue: function(clientId) {
      //console.log("Called empty queue");
      if (!this._server.hasConnection(clientId)) return;
      console.log(this._messages[clientId]);
      this._server.deliver(clientId, this._messages[clientId]);
      delete this._messages[clientId];
    }
  };
Faye.extend(Engine.prototype, Faye.Timeouts);
module.exports = Engine;