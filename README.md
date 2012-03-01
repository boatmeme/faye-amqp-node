# faye-amqp

This plugin provides an AMQP-based backend for the [Faye](http://faye.jcoglan.com)
messaging server. It allows a single Faye service to be distributed across many
front-end web servers by storing state and routing messages through any messaging service that implements AMQP such as
[RabbitMQ](http://www.rabbitmq.com/), [Qpid](http://qpid.apache.org), or [StormMQ](http://stormmq.com).


## Usage

Pass in the engine and any settings you need when setting up your Faye server.

```js
var faye  = require('faye'),
    amqp = require('faye-amqp'),
    http  = require('http');

var server = http.createServer();

var bayeux = new faye.NodeAdapter({
  mount:    '/',
  timeout:  25,
  engine: {
      type:   amqp,
      host:   'amqp.example.com',
	  // more options
      }
  });

  bayeux.attach(server);
  server.listen(8000);
  ```
  The full list of settings is as follows.

  * <b><tt>host</tt></b> - hostname of your AMQP broker
  * <b><tt>port</tt></b> - port number, default is `6379`
  * <b><tt>password</tt></b> - password
  * <b><tt>socket</tt></b> - path to Unix socket if `unixsocket` is set
  
## License

(The MIT License)

Copyright (c) 2012 Jonathan Griggs

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the 'Software'), to deal in
the Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
