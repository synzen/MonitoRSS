import React from 'react'
import { TEST_ACTION, CHANGE_PAGE, SET_ACTIVE_GUILD, SET_ACTIVE_FEED, CHANGE_FILTERS, CLEAR_GUILD, UPDATE_GUILD_AFTER_WEBSOCKET, INIT_STATE, ARTICLES_FETCHING, ARTICLES_ERROR, ARTICLES_FETCHED, UPDATE_LINK_STATUS, UPDATE_GUILD_LIMITS, SHOW_MODAL, HIDE_MODAL, UPDATE_SOURCE_SCHEDULE } from '../constants/action-types.js'
import axios from 'axios'
import toast from '../components/ControlPanel/utils/toast'

async function fetchArticles (guildId, feedId, dispatch) {
  dispatch(articlesFetching())
  try {
    const res = await axios.get(`/api/guilds/${guildId}/feeds/${feedId}/placeholders`)
    const allArticlePlaceholders = res.data
    dispatch(articlesFetched(allArticlePlaceholders))
  } catch (err) {
    console.log(err.data || err)
    const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
    toast.error(<p>Failed to fetch articles for feed<br /><br />{typeof errMessage === 'object' ? 'Unhandled Error' : errMessage || 'Unknown Error'}</p>)
    dispatch(articlesError(typeof errMessage === 'object' ? 'Unhandled Error' : errMessage || 'Unknown Error'))
  }
}

export function testAction (payload) {
  return { type: TEST_ACTION, payload }
}

export function initState (data) {
  return dispatch => {
    const { guildId, feedId } = data
    dispatch({ type: INIT_STATE, data })
    if (feedId && guildId) fetchArticles(guildId, feedId, dispatch)
  }
}

export function updateGuildAfterWebsocket (guildRss) {
  return { type: UPDATE_GUILD_AFTER_WEBSOCKET, guildRss }
}

export function changePage (page) {
  return (dispatch, getState) => {
    dispatch({ type: CHANGE_PAGE, page })
  }
}

export function changeFilters (rssName, data, guildId) {
  return { type: CHANGE_FILTERS, rssName, data, guildId }
}

export function clearGuild (guildId) {
  return { type: CLEAR_GUILD, guildId }
}

export function setActiveGuild (guildId) {
  return { type: SET_ACTIVE_GUILD, guildId }
}

export function setActiveFeed (rssName) {
  return async (dispatch, getState) => {
    const { guildId, feedId } = getState()
    if (rssName === feedId) return
    dispatch({ type: SET_ACTIVE_FEED, rssName })
    await fetchArticles(guildId, rssName, dispatch)
  }
}

export function articlesFetched (articleList) {
  return { type: ARTICLES_FETCHED, articleList }
}

export function articlesFetching (percent) {
  return { type: ARTICLES_FETCHING, percent }
}

export function articlesError (err) {
  return { type: ARTICLES_ERROR, err }
}

export function updateLinkStatus (data) {
  return { type: UPDATE_LINK_STATUS, data }
}

export function updateGuildLimits (limits) {
  return { type: UPDATE_GUILD_LIMITS, limits }
}

export function showModal (props, children) {
  return { type: SHOW_MODAL, props, children }
}

export function hideModal () {
  return { type: HIDE_MODAL }
}

export function updateSourceSchedule (data) {
  return { type: UPDATE_SOURCE_SCHEDULE, data }
}
