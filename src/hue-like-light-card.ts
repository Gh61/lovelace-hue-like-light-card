import { LovelaceCard, HomeAssistant } from 'custom-card-helpers';
import { HueLikeLightCardConfig } from './types/types';

class HueLikeLightCard extends HTMLElement implements LovelaceCard {
  private content!:HTMLDivElement;
  private config!:HueLikeLightCardConfig;

  // Whenever the state changes, a new `hass` object is set. Use this to
  // update your content.
  public set hass(hass: HomeAssistant) {
    // Initialize the content if it's not there yet.
    if (!this.content) {
      this.innerHTML = `
          <ha-card header='Example-card'>
            <div class='card-content'></div>
          </ha-card>
        `;
      this.content = this.querySelector('div')!;
    }

    const entityId = this.config.entity;
    const state = hass.states[entityId];
    const stateStr = state ? state.state : 'unavailable';

    this.content.innerHTML = `
        The state of ${entityId} is ${stateStr}!
        <br><br>
        <img src='http://via.placeholder.com/350x150'>
      `;
  }

  // The user supplied configuration. Throw an exception and Home Assistant
  // will render an error card.
  setConfig(config:HueLikeLightCardConfig) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = config;
  }

  // The height of your card. Home Assistant uses this to automatically
  // distribute all cards over the available columns.
  getCardSize() {
    return 3;
  }
}

customElements.define('hue-like-light-card', HueLikeLightCard);
