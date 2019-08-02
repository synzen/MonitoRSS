class LinkTracker {
  constructor (docs, bot) {
    this.list = {}
    this.shardId = bot && bot.shard && bot.shard.count > 0 ? bot.shard.id : undefined
    if (docs) for (var i in docs) this.set(docs[i].link, docs[i].count, docs[i].shard, docs[i].scheduleName)
  }

  get (link, scheduleName = 'default') {
    if (this.shardId == null) {
      if (!this.list[scheduleName] || !this.list[scheduleName][link]) return null
      return this.list[scheduleName][link]
    } else {
      if (!this.list[this.shardId] || !this.list[this.shardId][scheduleName] || !this.list[this.shardId][scheduleName][link]) return null
      return this.list[this.shardId][scheduleName][link]
    }
  }

  set (link, count, shardId, scheduleName) {
    if (shardId) {
      if (!this.list[shardId]) this.list[shardId] = {}
      if (!this.list[shardId][scheduleName]) this.list[shardId][scheduleName] = {}
      this.list[shardId][scheduleName][link] = count
    } else {
      if (!this.list[scheduleName]) this.list[scheduleName] = {}
      this.list[scheduleName][link] = count
    }
  }

  increment (link, scheduleName) {
    if (this.shardId !== undefined) {
      if (!this.list[this.shardId]) this.list[this.shardId] = {}
      if (!this.list[this.shardId][scheduleName]) this.list[this.shardId][scheduleName] = {}
      this.list[this.shardId][scheduleName][link] = this.list[this.shardId][scheduleName][link] ? this.list[this.shardId][scheduleName][link] + 1 : 1
      return this.list[this.shardId][scheduleName][link]
    } else {
      if (!this.list[scheduleName]) this.list[scheduleName] = {}
      this.list[scheduleName][link] = this.list[scheduleName][link] ? this.list[scheduleName][link] + 1 : 1
      return this.list[scheduleName][link]
    }
  }

  decrement (link, scheduleName) {
    if (this.shardId !== undefined) {
      if (this.list[this.shardId] == null || this.list[this.shardId][scheduleName] == null || this.list[this.shardId][scheduleName][link] == null) return
      this.list[this.shardId][scheduleName][link] = this.list[this.shardId][scheduleName][link] - 1 < 0 ? 0 : this.list[this.shardId][scheduleName][link] - 1
      if (!this.list[this.shardId][scheduleName][link]) delete this.list[this.shardId][scheduleName][link]
      return this.list[this.shardId][scheduleName][link]
    } else {
      if (this.list[scheduleName] == null || this.list[scheduleName][link] == null || this.list[scheduleName][link]) return
      this.list[scheduleName][link] = this.list[scheduleName][link] - 1 < 0 ? 0 : this.list[scheduleName][link] - 1
      if (!this.list[scheduleName][link]) delete this.list[scheduleName][link]
      return this.list[scheduleName][link]
    }
  }

  // Only links in the array
  toArray () {
    const arr = []
    for (var s in this.list) {
      for (var s2 in this.list[s]) {
        const shardLinks = this.list[s][s2]
        if (typeof shardLinks === 'number') { // If not a shard, then it directly holds the count (AKA number)
          if (!arr.includes(s)) arr.push(s2)
          continue
        }
        for (var l in shardLinks) if (!arr.includes(l)) arr.push(l)
      }
      return arr
    }
  }

  toDocs () {
    const arr = []
    for (var s in this.list) { // s = schedule name if no this.shardId, s = shard Id if there is this.shardId
      for (var s2 in this.list[s]) { // s2 = link url if there is no this.shardId, s2 = schedule name if there is shard Id
        const shardLinks = this.list[s][s2] // shardLinks = count if there is no this.shardId, shardLinks = link url if there is no shardId
        // Non sharded
        if (typeof shardLinks === 'number') {
          arr.push({ link: s2, count: shardLinks, scheduleName: s === 'undefined' ? undefined : s })
          continue
        }
        // Sharded
        for (var l in shardLinks) {
          arr.push({ link: l, count: shardLinks[l], shard: parseInt(s, 10), scheduleName: s2 === 'undefined' ? undefined : s2 })
        }
      }
    }
    return arr
  }
}

module.exports = LinkTracker
