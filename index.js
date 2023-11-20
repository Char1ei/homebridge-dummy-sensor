'use strict';

const { HomebridgeDummySensorVersion } = require('./package.json');

module.exports = (api) => {
  api.registerAccessory('homebridge-dummy-sensor','DummySensor', DummySensor);
};

class DummyContactSensor {

  constructor(log, config, api) {
      this.log = log;
      this.config = config;
      this.api = api;

      this.Service = this.api.hap.Service;
      this.Characteristic = this.api.hap.Characteristic;

      // Extract name from config
      this.name = config.name;

      // Setup Persistence Provider
      this.cacheDirectory = this.api.user.persistPath();
      
      this.storage = require('node-persist');
      this.storage.initSync({
        dir: this.cacheDirectory, 
        forgiveParseErrors: true
      });

      // Setup the Accessory Info Service
      this.informationService = new this.Service.AccessoryInformation();
      this.informationService
          .setCharacteristic(this.Characteristic.Manufacturer, 'Homebridge')
          .setCharacteristic(this.Characteristic.Model, 'Dummy Sensor')
          .setCharacteristic(this.Characteristic.FirmwareRevision, HomebridgeDummySensorVersion)
          .setCharacteristic(this.Characteristic.SerialNumber, 'Dummy-' + this.name.replace(/\s/g, '-'));

      // Setup the Sensor Service
      if (config.type === 'leak') {

        // Setup Leak Sensor Service
        this.sensorService = new this.Service.LeakSensor(this.name);
        this.sensorService.getCharacteristic(this.Characteristic.LeakDetected)
          .onGet(this.handleLeakDetectedGet.bind(this));
      } else {

        // Setup Contact Sensor Service
        this.sensorService = new this.Service.ContactSensor(this.name);
        this.sensorService.getCharacteristic(this.Characteristic.ContactSensorState)
          .onGet(this.handleContactSensorStateGet.bind(this));
      }

      // Setup the Switch Service
      this.switchService = new this.Service.Switch(this.name);
      this.switchService.getCharacteristic(this.Characteristic.On)
        .onGet(this.handleSwitchStateGet.bind(this))
        .onSet(this.handleSwitchStateSet.bind(this));
      this.switchService.setCharacteristic(this.Characteristic.On, this.isOn());
  }

  /**
   * Handle requests to set the current value of the Switch "On" characteristic
   */
  handleSwitchStateSet(value) {
    this.log.debug('Triggered SET On:', value);

    // Set value in Persistence Provider
    this.storage.setItemSync(this.name, value);

    // Set the Sensor State
    if (this.config.type === 'leak') {
      this.sensorService.setCharacteristic(
        this.Characteristic.LeakDetected,
        this.handleLeakDetectedGet()
      );
    } else {
      this.sensorService.setCharacteristic(
        this.Characteristic.ContactSensorState,
        this.handleContactSensorStateGet()
      );
    }
  }

  /**
   * Handle requests to get the current value of the Switch "On" characteristic
   * 
   * @returns Boolean representing the "on" or "off" states
   */
  handleSwitchStateGet() {
    this.log.debug('Triggered GET On');

    return this.isOn();
  }

  /**
   * Handle requests to get the current value of the Sensor "Leak Detected" characteristic
   * 
   * @returns Characteristic.LeakDetected representing the "detected" or "not detected" states
   */
  handleLeakDetectedGet() {
    this.log.debug('Triggered GET LeakDetected');

    return this.isOn() ? this.Characteristic.LeakDetected.LEAK_DETECTED : this.Characteristic.LeakDetected.LEAK_NOT_DETECTED;
  }

  /**
   * Handle requests to get the current value of the Sensor "Contact Sensor State" characteristic
   * 
   * @returns Characteristic.ContactSensorState representing the "detected" or "not detected" states
   */
  handleContactSensorStateGet() {
    this.log.debug('Triggered GET ContactSensorState');

    return this.isOn() ? this.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : this.Characteristic.ContactSensorState.CONTACT_DETECTED;
  }

  /**
   * Tells homebridge the various services provided by this accessory
   * 
   * @returns Array of Service objects
   */
  getServices() {
    return [
      this.informationService, 
      this.switchService, 
      this.sensorService
    ];
  }

  /**
   * Private function to get the current state of the accessory from the persistence provider
   * 
   * @returns Boolean representing the stored status of the accessory
   */
  isOn() {
    let cachedState = this.storage.getItemSync(this.name);
    if ((cachedState === undefined) || (cachedState === false)) {
      return false;
    } else {
      return true;
    }
  }
}