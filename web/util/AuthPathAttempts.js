class AuthPathAttempts {
  constructor () {
    this.storage = {}
  }

  add (ip, path) {
    this.storage[ip] = path
    setTimeout(() => {
      // Delete after 10 minutes
      delete this.storage[ip]
    }, 600000)
  }

  get (ip) {
    const path = this.storage[ip]
    delete this.storage[ip]
    return path
  }
}

module.exports = AuthPathAttempts
