import axios from 'axios'

class APIActions {
  constructor (prefix, url) {
    this.prefix = prefix
    this.url = url
    if (!prefix) {
      throw new TypeError('Missing prefix')
    }

    if (!url) {
      throw new TypeError('Missing URL')
    }

    // Redux probably changes the contest of 'this'
    this.fetch = this.fetch.bind(this)
  }

  fetch () {
    return dispatch => {
      dispatch(this.begin())
      axios.get(this.url).then(({ data, status }) => {
        dispatch(this.success(data))
      }).catch(err => {
        console.log(err)
        dispatch(this.failure(err))
      })
    }
  }

  success (guilds) {
    return {
      type: `${this.prefix}_SUCCESS`,
      payload: guilds
    }
  }

  begin () {
    return {
      type: `${this.prefix}_BEGIN`
    }
  }

  failure () {
    return {
      type: `${this.prefix}_FAILURE`
    }
  }
}

export default APIActions
