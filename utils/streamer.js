'use strict'

const {EventEmitter} = require('events')
const Fanfou = require('fanfou-sdk')
const retimer = require('retimer')

const {
  CONSUMER_KEY,
  CONSUMER_SECRET
} = require('../config')

class Streamer extends EventEmitter {
  constructor (tokens) {
    super()
    tokens = tokens || {}
    this.oauth_token = tokens.oauthToken
    this.oauth_token_secret = tokens.oauthTokenSecret
    this._init()
  }

  _init () {
    const ff = new Fanfou({
      auth_type: 'oauth',
      consumer_key: CONSUMER_KEY,
      consumer_secret: CONSUMER_SECRET,
      oauth_token: this.oauth_token,
      oauth_token_secret: this.oauth_token_secret
    })
    ff.get('/account/verify_credentials', {}, (err, res) => {
      if (err) console.log(err)
      else {
        this.id = res.id
        this.proto = ff.stream()
        this._reg()
        this.timer = retimer(() => {
          this.stop()
        }, 604800)
      }
    })
  }

  _reg () {
    this.proto.on('connected', () => {
      this.emit('connected')
    })

    this.proto.on('close', () => {
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
      console.log('error')
    })
  }

  renew () {
    if (!this.proto.is_streaming) this._init()
    this.timer.reschedule(604800)
  }

  stop () {
    this.proto.stop()
  }
}

module.exports = Streamer
