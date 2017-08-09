'use strict'

const {EventEmitter} = require('events')
const Fanfou = require('fanfou-sdk')
const retimer = require('retimer')
const log = require('fancy-log')

const {
  CONSUMER_KEY,
  CONSUMER_SECRET
} = require('../config')

class Streamer extends EventEmitter {
  constructor (tokens) {
    super()
    tokens = tokens || {}
    this.is_stop = false
    this.oauth_token = tokens.oauthToken
    this.oauth_token_secret = tokens.oauthTokenSecret
    this._init()
  }

  _init () {
    this.ff = new Fanfou({
      auth_type: 'oauth',
      consumer_key: CONSUMER_KEY,
      consumer_secret: CONSUMER_SECRET,
      oauth_token: this.oauth_token,
      oauth_token_secret: this.oauth_token_secret
    })
    this.ff.get('/account/verify_credentials', {}, (err, res) => {
      if (err) log(err)
      else {
        this.id = res.id
        this.proto = this.ff.stream()
        this._reg()
        this.stopTimer = retimer(() => {
          this.stop()
        }, 604800000)
        this.renewTimer = retimer(() => {
          this.renew()
        }, 60000)
      }
    })
  }

  _reg () {
    this.proto.on('connected', () => {
      log(this.id, 'connected')
      this.emit('connected')
    })

    this.proto.on('close', () => {
      log(this.id, 'close')
      this.emit('close')
    })

    this.proto.on('message', data => {
      if (data.is_mentioned && this.id !== data.source.id) {
        this.emit('mention', {
          by: data.mentioned_by,
          status: data.object
        })
      }

      if (data.is_replied && this.id !== data.source.id) {
        this.emit('reply', {
          by: data.replied_by,
          status: data.object
        })
      }
    })

    this.proto.on('fav', data => {
      if (data.action === 'create') {
        this.emit('add-fav', {
          by: data.source.name,
          status: data.object
        })
      }
      if (data.action === 'delete') {
        this.emit('del-fav', {
          by: data.source.name,
          status: data.object
        })
      }
    })

    this.proto.on('error', data => {
      log(this.id, 'error')
    })

    this.proto.on('close', data => {
      log(this.id, 'streaming closed')
    })
  }

  renew () {
    if (!this.ff.is_streaming && !this.is_stop) {
      log(this.id, 'renew')
      this._init()
    }
    this.renewTimer.reschedule(60000)
    log(this)
    this.stopTimer.reschedule(604800000)
  }

  stop () {
    this.is_stop = true
    this.proto.stop()
    log(this.id, 'stop')
  }
}

module.exports = Streamer
