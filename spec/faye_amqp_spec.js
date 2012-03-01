var AmqpEngine = require('../faye-amqp')

JS.ENV.FayeAmqpSpec = JS.Test.describe("AMQP engine", function() { with(this) {
  before(function() {
    var pw = process.env.TRAVIS ? undefined : "foobared"
    this.engineOpts = {type: AmqpEngine}
  })
  
  after(function(resume) { with(this) {
    sync(function() {
      engine.disconnect()
      //var amqp = amqp.createConnection({url:localhost});
      //
      //redis.auth(engineOpts.password)
      //redis.flushall(function() {
      //  redis.end()
      //  resume()
      //})
    })
  }})
  
  itShouldBehaveLike("faye engine")
  
  describe("distribution", function() { with(this) {
    itShouldBehaveLike("distributed engine")
  }})
  
  if (process.env.TRAVIS) return
  
}})
