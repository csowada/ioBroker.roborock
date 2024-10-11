"use strict";

const mqtt = require("mqtt");

const EventEmitter = require("node:events");
const fs = require("node:fs");

class FakeAdapter extends EventEmitter {

  /** @type {Set<NodeJS.Timeout>} */
  _timers = new Set();

  /** @type {Set<NodeJS.Timeout>} */
  _intervals = new Set();

  // eventEmitter = new EventEmitter();
  language = "en"

  _logger = {
    log(message, ...optionalParams) {
      console.log(message, optionalParams);
    },
    error(message, ...optionalParams) {
      console.error(message, optionalParams);
    },
    info(message, ...optionalParams) {
      console.info(message, optionalParams);
    },
    debug(message, ...optionalParams) {
      console.debug(message, optionalParams);
    },
    warn(message, ...optionalParams) {
      console.warn(message, optionalParams);
    }
  }

  /**
   * @type {{[key: string]: {val: any, ack: boolean}}}
   */

  states = {}
  /**
   * @type {{[key: string]: any}}
   */
  objects = {}

  config = {
    username: process.env['RR_USERNAME'],
    password: process.env['RR_PASSWORD'],
    updateInterval: 30,
    localMqttUrl: process.env['LOCAL_MQTT'],
    localMqqtPrefix: 'aaa-rr2'
    // cameraPin: null,
    // enable_map_creation: true,
    // webserverPort: 8080
  }

  log = this._logger;

  /** @type {mqtt.MqttClient | null} */
  mqttClient = null;

  constructor(options) {
    super();


    // this._timers = new Set();

    // this._intervals = new Set();

    if (fs.existsSync('./data/states.json')) {
      let states = fs.readFileSync('./data/states.json', 'utf8');
      this.states = JSON.parse(states);
    }

    // if (fs.existsSync('./objects.json')) {
    //   let objects = fs.readFileSync('./objects.json', 'utf8');
    //   this.objects = JSON.parse(objects);
    // }

    this._init();

    this._initMqtt(this.config.localMqttUrl);
  }

  _initMqtt(brokerUrl) {
    const that = this;
    this.mqttClient = mqtt.connect(brokerUrl, {});

    this.mqttClient.on('connect', function () {
      that.log.info('Local mqqt client connected!');

      Object.entries(that.objects).forEach(([id, obj]) => {
        if (!id.endsWith('.map.mapData') && !id.endsWith('.map.mapBase64Truncated') && !id.endsWith('.map.mapBase64')) {
          that.publishMqtt(id, obj, 'objects');
        }
      });

      Object.entries(that.states).forEach(([id, state]) => {
        that.publishMqtt(id, state, 'states');
      });
    });
  }

  async _writeStatestoFile() {
    fs.writeFileSync('./data/states.json', JSON.stringify(this.states, null, 2));
  }
  async _writeObjectsstoFile() {
    // fs.writeFileSync('./data/objects.json', JSON.stringify(this.states, null, 2));
  }

  /**
   * 
   * @param {string} id 
   * @param {any} state 
   */
  publishMqtt(id, state, type) {
    if (this.mqttClient && this.mqttClient.connected) {
      const key = id.replaceAll('.', '/');
      if (type === "states") {
        this.mqttClient.publish(`${this.config.localMqqtPrefix}/${type}/${key}`, JSON.stringify(state.val));
      } else {
        this.mqttClient.publish(`${this.config.localMqqtPrefix}/${type}/${key}`, JSON.stringify(state));
      }
    }
  }

  updateNewWay(data) {
    // console.warn("-------------------------->" + Object.keys(data));
    // this.setStateAsync()
  }

  // on(eventName, func) {
  //   console.log(`on('${eventName}', func())`);
  //   this.eventEmitter.on(eventName, func);
  // }

  subscribeStates(id) {
    console.log(`subscribeStates('${id}')`);
  }

  async deleteStateAsync(id) {
    console.log(`deleteStateAsync('${id}')`);
    delete this.states[id];

    await this._writeStatestoFile();
  }

  async setStateAsync(id, state, flag) {
    console.log(`setStateAsync('${id}', '${JSON.stringify(state)}, ${flag}')`);

    const oldState = this.states[id];

    this.states[id] = state;

    this.publishMqtt(id, state, 'states');
    
    if (JSON.stringify(oldState) !== JSON.stringify(state)) {

      if (id == "clientID") {
        await this._writeStatestoFile();
      }
      this.emit('stateChange', id, state);
    }
  }

  async setObjectNotExistsAsync(id, state) {
    console.log(`setObjectNotExistsAsync('${id}', '${JSON.stringify(state)}')`);
    if (!this.objects[id]) {
      await this.setObjectAsync(id, state);
    }
  }

  async setObjectAsync(id, state) {
    console.log(`setObjectAsync('${id}', '${JSON.stringify(state)}')`);
    this.objects[id] = state;

    await this._writeObjectsstoFile();
  }

  async getStateAsync(id) {
    return this.states[id];
  }

  async getObjectAsync(id) {
    return this.objects[id];
  }

  async setStateChangedAsync(id, state) {
    console.log(`setStateChangedAsync('${id}', '${JSON.stringify(state)}')`);
    if (JSON.stringify(this.states[id]) !== JSON.stringify(state)) {
      await this.setStateAsync(id, state);
    }
  }

  supportsFeature(featureName) {
    return false;
  }

  getPluginInstance(name) {
    return null;
  }

  setTimeout(cb, timeout, ...args) {
    const timer = setTimeout(
      () => {
        this._timers.delete(timer);
        cb(...args);
      },
      timeout,
    );
    this._timers.add(timer);
    return timer;
  }

  setInterval(cb, timeout, ...args) {

    if (typeof cb !== 'function') {
      this._logger.error(
        `setInterval expected callback to be of type "function", but got "${typeof cb}"`,
      );
      return;
    }

    const id = setInterval(() => cb(...args), timeout);
    this._intervals.add(id);

    return id;
  }

  clearInterval(interval) {
    if (interval === undefined) {
      return;
    }

    // should we further validate it is a valid interval?
    clearInterval(interval);
    this._intervals.delete(interval);
  }

  clearTimeout(timer) {
    if (timer === undefined) {
      return;
    }

    // should we further validate this?
    clearTimeout(timer);
    this._timers.delete(timer);
  }

  _init() {

    const that = this;
    this.setTimeout(() => {
      that.emit('ready');
    }, 1000);
    // process.once('SIGINT', () => this._stop());
    // process.once('SIGTERM', () => this._stop());
    // // And the exit event shuts down the child.
    // process.once('exit', () => this._stop());

    // process.on('uncaughtException', err => this._exceptionHandler(err));
    // process.on('unhandledRejection', err => this._exceptionHandler(err as any, true));
  }
}

module.exports = {
  Adapter: FakeAdapter,
};
