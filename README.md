# Hue-Like Light Card for Home Assistant

This card is providing light control. It is inspired by original Philips Hue app.

![Screen1](/doc/screen1.png)

\* *intensity of color, shadow and other UI properties may be subject of change*

## Instalation
TODO: HACS

## Configuration
<table>
  <tr>
    <th>Key</th>
    <th>Type</th>
    <th>Required</th>
    <th>Default</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>entity</code></td>
    <td>string</td>
    <td>yes*</td>
    <td>-</td>
    <td>Light entity name (eg. <code>light.my_light</code>)</td>
  </tr>
  <tr>
    <td><code>entities</code></td>
    <td>list of strings</td>
    <td>yes*</td>
    <td>-</td>
    <td>Multiple Light entity names</td>
  </tr>
  <tr>
    <td><code>title</code></td>
    <td>string</td>
    <td>no</td>
    <td><i>Lights name</i></td>
    <td>Card title</td>
  </tr>
  <tr>
    <td><code>icon</code></td>
    <td>string</td>
    <td>no</td>
    <td><i><a href="#automatic-icon">automatic</a></i></td>
    <td>Card icon</td>
  </tr>
  <tr>
    <td><code>allowZero</code></td>
    <td>boolean</td>
    <td>no</td>
    <td><code>false</code></td>
    <td>If turned on, the slider can be moved to and from value 0.<br/>(turning off/on the the lights)</td>
  </tr>
  <tr>
    <td><code>defaultColor</code></td>
    <td>string</td>
    <td>no</td>
    <td><code>'warm'</code></td>
    <td>
      If selected light (or lights) don't has RGB mode,<br/>this value is color is used when the light is on.<br/>Possible format:
      <ul>
        <li>HEX: <code>'#fff'</code>, <code>'#ffffff'</code></li>
        <li>RGB: <code>'rgb(255,255,255)'</code></li>
        <li>WEB name: <code>'white'</code></li>
        <li>predefined: <code>'warm'</code> or <code>'cold'</code></td></li>
      </ul>
  </tr>
  <tr>
    <td><code>offColor</code></td>
    <td>string</td>
    <td>no</td>
    <td><code>'#666'</code></td>
    <td>
      The color of the pane, when all lights are off.<br/>Possible format:
      <ul>
        <li>HEX: <code>'#fff'</code>, <code>'#ffffff'</code></li>
        <li>RGB: <code>'rgb(255,255,255)'</code></li>
        <li>WEB name: <code>'white'</code></li>
      </ul>
    </td>
  </tr>
  <tr>
    <td><code>disableOffShadow</code></td>
    <td>boolean</td>
    <td>no</td>
    <td><code>false</code></td>
    <td>If turned on, the card will not have inner shadow, when all lights are off.</td>
  </tr>
  <tr>
    <td><code>hueBorders</code></td>
    <td>boolean</td>
    <td>no</td>
    <td><code>true</code></td>
    <td>If turned off, the card will not have so much rounded edges. It will have default edge rounding instead.</td>
  </tr>
  <tr>
    <td colspan="5" style="text-align: center">
      <i>* At least one of this two must be filled in</i>
    </td>
  </tr>
</table>

### Automatic Icon
- If the card has one light entity attached, the icon is taken from entity.
    - If the entity has no icon, `mdi:lightbulb` (![lightbulb](https://user-images.githubusercontent.com/10837736/171443813-5e0dc16c-de15-43a1-9e96-0917c038e0a9.svg)) is used.
- If the card has two lights `mdi:lightbulb-multiple` (![lightbulb-multiple](https://user-images.githubusercontent.com/10837736/171444016-4b571fcf-0e30-4eca-9baf-61a710c17c05.svg)) is used.
- If the card has three or more lights attached, `mdi:lightbulb-group` (![lightbulb-group](https://user-images.githubusercontent.com/10837736/171444069-639d41d5-1dc7-4bd7-8104-b77f52df86fb.svg)) is used.
