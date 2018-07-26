class LinkTracker {
  constructor (docs, bot) {
    this.list = {}
    this.shardId = bot && bot.shard && bot.shard.count > 0 ? bot.shard.id : undefined
    if (docs) for (var i in docs) this.set(docs[i].link, docs[i].count, docs[i].shard)
  }

  get (link) {
    return this.shardId === undefined ? this.list[link] : this.list[this.shardId] ? this.list[this.shardId][link] : null
  }

  set (link, count, shardId) {
    if (shardId) {
      if (!this.list[shardId]) this.list[shardId] = {}
      this.list[shardId][link] = count
    } else this.list[link] = count
  }

  increment (link) {
    if (this.shardId !== undefined) {
      if (!this.list[this.shardId]) this.list[this.shardId] = {}
      this.list[this.shardId][link] = this.list[this.shardId][link] ? this.list[this.shardId][link] + 1 : 1
      return this.list[this.shardId][link]
    } else {
      this.list[link] = this.list[link] ? this.list[link] + 1 : 1
      return this.list[link]
    }
  }

  decrement (link) {
    if (this.shardId !== undefined) {
      if (this.list[this.shardId] == null || this.list[this.shardId][link] == null) return
      this.list[this.shardId][link] = this.list[this.shardId][link] - 1 < 0 ? 0 : this.list[this.shardId][link] - 1
      if (!this.list[this.shardId][link]) delete this.list[this.shardId][link]
      return this.list[this.shardId][link]
    } else {
      if (this.list[link] == null) return
      this.list[link] = this.list[link] - 1 < 0 ? 0 : this.list[link] - 1
      if (!this.list[link]) delete this.list[link]
      return this.list[link]
    }
  }

  // Only links in the array
  toArray () {
    const arr = []
    for (var s in this.list) {
      const shardLinks = this.list[s]
      if (typeof shardLinks === 'number') { // If not a shard, then it directly holds the count (AKA number)
        if (!arr.includes(s)) arr.push(s)
        continue
      }
      for (var l in shardLinks) if (!arr.includes(l)) arr.push(l)
    }
    return arr
  }

  toDocs () {
    const arr = []
    for (var s in this.list) {
      const shardLinks = this.list[s]
      if (typeof shardLinks === 'number') {
        arr.push({ link: s, count: shardLinks })
        continue
      }
      for (var l in shardLinks) {
        arr.push({ link: l, count: shardLinks[l], shard: parseInt(s, 10) })
      }
    }
    return arr
  }
}

module.exports = LinkTracker
