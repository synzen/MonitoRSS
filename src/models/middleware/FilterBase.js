async function checkEmptyFilters () {
  this.filters.forEach((value, key, map) => {
    if (value.length === 0) {
      map.delete(key)
    }
  })
}

module.exports = {
  checkEmptyFilters
}
