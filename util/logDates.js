// http://stackoverflow.com/questions/18814221/adding-timestamps-to-all-console-messages
module.exports = function () {
  let log = console.log

  console.log = function () {
    let firstParam = arguments[0]
    let otherParams = Array.prototype.slice.call(arguments, 1)

    function formatConsoleDate (date) {
      let hour = date.getHours()
      let minutes = date.getMinutes()
      let seconds = date.getSeconds()
      let milliseconds = date.getMilliseconds()

      return '[' +
               ((hour < 10) ? '0' + hour : hour) +
               ':' +
               ((minutes < 10) ? '0' + minutes : minutes) +
               ':' +
               ((seconds < 10) ? '0' + seconds : seconds) +
               '.' +
               ('00' + milliseconds).slice(-3) +
               '] '
    }

    log.apply(console, [formatConsoleDate(new Date()) + firstParam].concat(otherParams))
  }
}
