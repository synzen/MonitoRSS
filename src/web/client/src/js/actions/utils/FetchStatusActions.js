class FetchStatusActions {
  constructor(BASE_ACTION) {
    if (!BASE_ACTION) {
      throw new TypeError('BASE_ACTION is missing for FetchStatusActions')
    }
    if (!BASE_ACTION.SUCCESS || !BASE_ACTION.FAILURE || !BASE_ACTION.BEGIN) {
      throw new TypeError(`BASE_ACTION ${BASE_ACTION} is missing SUCCESS, FAILURE, OR BEGIN properties`)
    }
    this.BASE_ACTION = BASE_ACTION
  }

  success = (data) => {
    return {
      type: this.BASE_ACTION.SUCCESS,
      payload: data
    }
  }
  
  failure = (error) => {
    return {
      type: this.BASE_ACTION.FAILURE,
      payload: error
    }
  }
  
  begin = () => {
    return {
      type: this.BASE_ACTION.BEGIN
    }
  }
}

export default FetchStatusActions
