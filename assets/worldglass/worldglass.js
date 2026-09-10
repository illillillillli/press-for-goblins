(function () {
  'use strict';

  var events = [
    { id: 'lbf', name: 'london book fair', city: 'london', date: '12 mar', lat: 51.5072, lon: -.1276 },
    { id: 'mcm', name: 'mcm comic con', city: 'london', date: '22–24 may', lat: 51.5072, lon: -.1276 },
    { id: 'develop', name: 'develop:brighton', city: 'brighton', date: '15 jul', lat: 50.8225, lon: -.1372 },
    { id: 'gamescom', name: 'gamescom', city: 'cologne', date: '26–29 aug', lat: 50.9375, lon: 6.9603 },
    { id: 'ble', name: 'brand licensing europe', city: 'london', date: '7 oct', lat: 51.5072, lon: -.1276 },
    { id: 'fantasycon', name: 'fantasycon', city: 'glasgow', date: '10 oct', lat: 55.8642, lon: -4.2518 },
    { id: 'yalc', name: 'yalc', city: 'london', date: '1 nov', lat: 51.5072, lon: -.1276 },
    { id: 'thought-bubble', name: 'thought bubble', city: 'harrogate', date: '15 nov', lat: 53.9921, lon: -1.5418 }
  ];

  var runes = {
    A:'M9.2 9.6 L6.4 11.9 L1.4 10 L5.3 5.1 L9.2 9.6',B:'M3.8 6.3 L4.6 5.6 L5.5 5.2 L6.6 5.3 L7.6 5.7 L8.3 6.4 L8.7 7.4 L8.8 8.4 L8.4 9.4',C:'M5.1 5.3 Q7.4 3 9.7 5.3 Q7.4 7.6 5.1 5.3 M5 11 Q7.4 8.6 9.8 11 Q7.4 13.4 5 11',D:'M3.2 4 C8.4 7.3 2.6 10.5 7.6 13 M2 4 L4.4 4 M6.4 13 L8.8 13',E:'M3.5 9 Q7.5 6.2 11.5 9 Q7.5 11.8 3.5 9 M7 9 L8 9',F:'M4.3 4.5 L4.3 12.5 M4.3 6.6 L8.7 6.6 M4.3 10.4 L8.7 10.4',G:'M1.6 9.5 Q5.9 1.8 10.2 9.5 M3.5 9.5 Q5.9 5.2 8.3 9.5',H:'M5.3 4.3 L5.3 12.2 M9.9 7 Q8.8 9.5 9.9 12.2',I:'M6.2 5.9 L8.7 8.4 L6.2 10.9 L3.7 8.4 Z',J:'M6.6 1.8 L6.6 11.3 M1 5.8 L9.2 6.3',K:'M3.7 9.3 L10.5 9.3 M3.7 9.3 L3.7 5.6 L4.9 6.3 M7.1 9.3 L7.1 5 L8 5.5 M10.5 9.3 L10.5 5.4 L9.2 6',L:'M5.3 3.5 L5.3 13.5 M7 7.6 Q9 8.8 7 10',M:'M2.8 5.7 L9.9 5.7 M2.8 5.7 L2.7 11.1 M5.3 5.7 L5.3 14.8 M7.4 5.7 L7.4 12.1',N:'M2 5.1 L5 11.9 L8 7.5 L11 10.7',O:'M4.3 4.7 Q2.5 7.95 4.3 11.2 M9.3 4.7 Q11.1 7.95 9.3 11.2',P:'M3.5 5.8 Q9.6 6.7 9.9 11.4 M8.9 7.7 Q3.7 11.1 4.3 10.7',Q:'M2.9 3.5 L4 3 L5.4 3 L6.4 3.6 L6.7 4.9 L6.1 6.2 L4.9 6.8 L3.6 6.5 L2.7 5.5 M2.7 5.5 Q3.4 7.1 1.5 7.5',R:'M6.9 5.6 L8.6 8.4 L6.9 11.2 L5.2 8.4 Z',S:'M5.5 7 L4 10.5 M8 5.5 L6.5 10.5 M10.5 5.5 L9 10.5',T:'M6.3 4.5 L9.9 11.1 L5.1 10.5 L7.6 8.9 L3.8 10.4 L9.3 6 L6.3 4.5',U:'M1 7.1 Q3 3.3 5 7.1 Q7 10.9 9 7.1 Q10 3.3 11 7.1',V:'M5 5.7 Q8.1 8.3 8.5 12.1 Q7.4 12.6 6.8 12.1',W:'M5.3 3 L6.6 3.1 L7.2 4.3 L6.9 5.6 L5.7 6.3 L4.4 6.2 L3.5 5.2 L3.5 3.8 L4.4 3 M5.3 6.4 Q5.4 10.2 6.1 14',X:'M7.8 6.2 L10.5 6.2 M9.5 4.5 L9.5 7.9',Y:'M2.8 7.6 L3.8 7.6 M4.2 10.2 L5.2 10.2',Z:'M9.2 7.4 L6.4 5.1 L1.4 7 L5.3 11.9 L9.2 7.4'
  };
  var runeKeys = Object.keys(runes);
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var root;
  var canvas;
  var context;
  var docks;
  var dockNodes = [];
  var coastRings = [];
  var width = 0;
  var height = 0;
  var dpr = 1;
  var centreX = 0;
  var centreY = 0;
  var baseRadius = 0;
  var radius = 0;
  var yaw = -.075;
  var pitch = -.36;
  var velocityX = 0;
  var velocityY = 0;
  var zoom = 1;
  var targetZoom = 1;
  var defaultZoom = 1;
  var zoomInitialised = false;
  var dragging = false;
  var moved = false;
  var pointerId = null;
  var touchPoints = new Map();
  var pinching = false;
  var pinchStartDistance = 0;
  var pinchStartZoom = 1;
  var pointerStartX = 0;
  var pointerStartY = 0;
  var lastX = 0;
  var lastY = 0;
  var lastTime = 0;
  var dragThreshold = 3;
  var selectedId = null;
  var markerHoverId = null;
  var markerHoverButton = null;
  var lastInteractionAt = performance.now();
  var visible = true;
  var frameId = 0;
  var lastFrame = 0;
  var settleAt = 0;
  var assignments = [];
  var introduced = false;
  var introductionStarted = false;
  var introTimers = [];
  var connectionsIntroducedAt = 0;
  var nextLabelShimmerAt = 0;
  var layoutFrame = 0;
  var layoutRevision = 0;
  var lastMobileLayout = null;

  function sphere(lat, lon) {
    var a = lat * Math.PI / 180;
    var b = lon * Math.PI / 180;
    var c = Math.cos(a);
    return { x: c * Math.sin(b), y: -Math.sin(a), z: c * Math.cos(b) };
  }

  function rotate(point) {
    var yawCos = Math.cos(yaw);
    var yawSin = Math.sin(yaw);
    var pitchCos = Math.cos(pitch);
    var pitchSin = Math.sin(pitch);
    var x = point.x * yawCos + point.z * yawSin;
    var z = -point.x * yawSin + point.z * yawCos;
    return { x: x, y: point.y * pitchCos - z * pitchSin, z: point.y * pitchSin + z * pitchCos };
  }

  function project(point) {
    var depth = 3.8 - point.z;
    var scale = 3.8 / depth;
    return { x: centreX + point.x * radius * scale, y: centreY + point.y * radius * scale, z: point.z };
  }

  function latitude(value) {
    var points = [];
    for (var lon = -180; lon <= 180; lon += 3) points.push(sphere(value, lon));
    return points;
  }

  function longitude(value) {
    var points = [];
    for (var lat = -90; lat <= 90; lat += 3) points.push(sphere(lat, value));
    return points;
  }

  function drawPath(points, colour) {
    var started = false;
    var previous = null;
    context.beginPath();
    points.forEach(function (raw) {
      var point = rotate(raw);
      var screen = project(point);
      if (point.z < -.025) { started = false; previous = null; return; }
      if (previous && Math.hypot(screen.x - previous.x, screen.y - previous.y) > radius * .22) started = false;
      if (!started) { context.moveTo(screen.x, screen.y); started = true; }
      else context.lineTo(screen.x, screen.y);
      previous = screen;
    });
    context.strokeStyle = colour;
    context.stroke();
  }

  function makeGlyph(character) {
    var span = document.createElement('span');
    span.className = 'worldglass-glyph';
    if (character === ' ') { span.classList.add('is-space'); return span; }
    if (!/[a-z]/i.test(character)) {
      var literal = document.createElement('span');
      literal.className = 'worldglass-glyph-literal';
      literal.textContent = character;
      span.append(literal);
      return span;
    }
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 12 16');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', runes[character.toUpperCase()]);
    svg.append(path);
    span.append(svg);
    var latin = document.createElement('span');
    latin.className = 'worldglass-glyph-latin';
    latin.textContent = character.toLowerCase();
    span.append(latin);
    span._path = path;
    span._latin = latin;
    span._original = path.getAttribute('d');
    return span;
  }

  function makeLine(text) {
    var line = document.createElement('span');
    line.className = 'worldglass-line';
    var runeLayer = document.createElement('span');
    runeLayer.className = 'worldglass-runes';
    Array.from(text).forEach(function (character) { runeLayer.append(makeGlyph(character)); });
    line.append(runeLayer);
    line._text = text;
    line._runes = runeLayer;
    return line;
  }

  function makeLabel(index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'worldglass-label';
    button.dataset.dock = String(index);
    button.addEventListener('pointerenter', function () {
      button._shouldReturn = false;
      clearTimeout(button._returnTimer);
      if (button._decoded) acknowledgeLabel(button);
    });
    button.addEventListener('pointerleave', function () {
      button._shouldReturn = true;
      scheduleLabelReturn(button);
    });
    button.addEventListener('focus', function () {
      button._shouldReturn = false;
      clearTimeout(button._returnTimer);
      if (button._decoded) acknowledgeLabel(button);
    });
    button.addEventListener('blur', function () {
      button._shouldReturn = true;
      scheduleLabelReturn(button);
    });
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      if (moved && event.detail !== 0) return;
      activateLabel(button);
    });
    return button;
  }

  function activateLabel(button) {
    selectedId = button.dataset.eventId;
    dockNodes.forEach(function (node) {
      if (node.dataset.eventId === selectedId) {
        /* Each record owns its own reveal cycle. Activating another record must
           never interrupt or recode this one. */
        node._shouldReturn = true;
        if (node._decoded) {
          acknowledgeLabel(node);
          scheduleLabelReturn(node);
        }
        else decodeLabel(node);
      }
    });
  }

  function assignLabel(button, event) {
    if (!event) {
      button.classList.remove('is-visible');
      button.removeAttribute('data-event-id');
      button.replaceChildren();
      return;
    }
    if (button.dataset.eventId === event.id) return;
    clearTimeout(button._returnTimer);
    button._generation = (button._generation || 0) + 1;
    button._decoded = false;
    button._decoding = false;
    button._encoding = false;
    button._decodeAfterEncode = false;
    button._shouldReturn = true;
    button.classList.remove('is-visible');
    button.classList.remove('is-interactive');
    button.classList.remove('is-decoded', 'is-decoding', 'is-encoding');
    button.dataset.eventId = event.id;
    button.setAttribute('aria-label', event.name + ', ' + event.date + ', ' + event.city);
    button.style.removeProperty('width');
    button.replaceChildren(makeLine(event.name), makeLine(event.date + ' · ' + event.city));
    requestAnimationFrame(function () {
      button.classList.add('is-visible');
      if (button.matches(':hover, :focus')) decodeLabel(button);
    });
  }

  function acknowledgeLabel(button) {
    button.classList.remove('is-acknowledged');
    void button.offsetWidth;
    button.classList.add('is-acknowledged');
    clearTimeout(button._ackTimer);
    button._ackTimer = setTimeout(function () { button.classList.remove('is-acknowledged'); }, 190);
  }

  function scheduleLabelShimmer(delay) {
    nextLabelShimmerAt = reduced.matches ? Infinity : performance.now() + (delay == null ? 3000 + Math.floor(Math.random() * 4000) : delay);
  }

  function shimmerEncodedLabel() {
    var candidates = dockNodes.filter(function (button) {
      return button.classList.contains('is-visible') &&
        button.classList.contains('is-interactive') &&
        !button._decoded && !button._decoding && !button._encoding;
    });
    var button = candidates[Math.floor(Math.random() * candidates.length)];
    var firstLine = button && button.querySelector('.worldglass-line');
    var glyphs = firstLine ? Array.from(firstLine.querySelectorAll('.worldglass-glyph')).filter(function (glyph) { return glyph._path; }) : [];
    var count = 1 + Math.floor(Math.random() * 3);
    var picked = [];
    while (picked.length < count && glyphs.length) picked.push(glyphs.splice(Math.floor(Math.random() * glyphs.length), 1)[0]);
    picked.forEach(function (glyph, glyphIndex) {
      setTimeout(function () {
        if (button._decoded || button._decoding || button._encoding) return;
        var round = 0;
        var interval = setInterval(function () {
          if (button._decoded || button._decoding || button._encoding) {
            clearInterval(interval);
            glyph._path.setAttribute('d', glyph._original);
            return;
          }
          glyph._path.setAttribute('d', runes[runeKeys[Math.floor(Math.random() * runeKeys.length)]]);
          round += 1;
          if (round >= 3) {
            clearInterval(interval);
            glyph._path.setAttribute('d', glyph._original);
          }
        }, 50);
      }, glyphIndex * 60);
    });
    scheduleLabelShimmer();
  }

  function decodeLine(line, delay, instant, token, palette) {
    var glyphs = Array.from(line._runes.children);
    if (instant) {
      glyphs.forEach(function (glyph) {
        if (!glyph._path) return;
        glyph._path.style.opacity = '0';
        glyph._latin.style.opacity = '1';
      });
      return 0;
    }
    var stagger = 64;
    var scramble = 102;
    var rounds = 5;
    var fade = 30;
    var oceanColours = palette;
    glyphs.forEach(function (glyph, glyphIndex) {
      if (!glyph._path) return;
      setTimeout(function () {
        if (line.closest('.worldglass-label')._motionToken !== token) return;
        var round = 0;
        var interval = setInterval(function () {
          if (line.closest('.worldglass-label')._motionToken !== token) { clearInterval(interval); return; }
          var decay = 1 - round / rounds;
          glyph.style.transform = 'translateX(' + ((Math.random() * 2 - 1) * 5 * decay).toFixed(1) + 'px)';
          glyph._path.style.stroke = oceanColours[round % oceanColours.length];
          glyph._path.setAttribute('d', runes[runeKeys[Math.floor(Math.random() * runeKeys.length)]]);
          round += 1;
          if (round >= rounds) {
            clearInterval(interval);
            glyph.style.transform = '';
            glyph._path.style.removeProperty('stroke');
            glyph._path.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, easing: 'ease-out', fill: 'forwards' });
            glyph._latin.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade, easing: 'ease-out', fill: 'forwards' });
          }
        }, scramble);
      }, delay + glyphIndex * stagger);
    });
    var duration = delay + Math.max(0, glyphs.length - 1) * stagger + rounds * scramble;
    return duration + fade;
  }

  function decodeLabel(button) {
    clearTimeout(button._returnTimer);
    if (!button.classList.contains('is-visible') || !button.classList.contains('is-interactive') || button._decoded || button._decoding) return;
    if (button._encoding) {
      if (button._reverseTimer) return;
      button._reverseTimer = setTimeout(function () {
        button._reverseTimer = null;
        button._motionToken = (button._motionToken || 0) + 1;
        button.querySelectorAll('.worldglass-glyph').forEach(function (glyph) {
          glyph.getAnimations().forEach(function (animation) { animation.cancel(); });
          if (glyph._path) glyph._path.getAnimations().forEach(function (animation) { animation.cancel(); });
          if (glyph._latin) glyph._latin.getAnimations().forEach(function (animation) { animation.cancel(); });
          glyph.style.transform = '';
        });
        button._encoding = false;
        button._decoded = false;
        button.classList.remove('is-encoding');
        decodeLabel(button);
      }, reduced.matches ? 0 : 90);
      return;
    }
    button._decoding = true;
    button.classList.add('is-decoding');
    var generation = button._generation;
    var lines = button.querySelectorAll('.worldglass-line');
    var instant = reduced.matches;
    var token = button._motionToken = (button._motionToken || 0) + 1;
    var firstDone = decodeLine(lines[0], 0, instant, token, ['#74c58d', '#fffccc', '#fdfd96', '#fffccc', '#74c58d', '#fdfd96', '#74c58d']);
    var secondDone = decodeLine(lines[1], firstDone + (instant ? 0 : 80), instant, token, ['#8c8c8c', '#fffccc', '#fdfd96', '#fffccc', '#8c8c8c', '#fdfd96', '#8c8c8c']);
    setTimeout(function () {
      if (button._generation !== generation || button._motionToken !== token) return;
      button._decoded = true;
      button._decoding = false;
      button.classList.remove('is-decoding');
      button.classList.add('is-decoded');
      if (button._shouldReturn) scheduleLabelReturn(button);
    }, secondDone);
  }

  function encodeLine(line, delay, instant, token, palette) {
    var glyphs = Array.from(line._runes.children);
    if (instant) {
      glyphs.forEach(function (glyph) {
        if (!glyph._path) return;
        glyph._path.style.opacity = '1';
        glyph._latin.style.opacity = '0';
      });
      return 0;
    }
    var stagger = 64;
    var scramble = 102;
    var rounds = 5;
    var fade = 30;
    var oceanColours = palette;
    glyphs.forEach(function (glyph, glyphIndex) {
      if (!glyph._path) return;
      setTimeout(function () {
        if (line.closest('.worldglass-label')._motionToken !== token) return;
        glyph._latin.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade * .6, easing: 'ease-out', fill: 'forwards' });
        setTimeout(function () {
          var round = 0;
          glyph._path.setAttribute('d', glyph._original);
          glyph._path.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade * .4, easing: 'ease-out', fill: 'forwards' });
          var interval = setInterval(function () {
            if (line.closest('.worldglass-label')._motionToken !== token) { clearInterval(interval); return; }
            var decay = 1 - round / rounds;
            glyph.style.transform = 'translateX(' + ((Math.random() * 2 - 1) * 5 * decay).toFixed(1) + 'px)';
            glyph._path.style.stroke = oceanColours[round % oceanColours.length];
            glyph._path.setAttribute('d', runes[runeKeys[Math.floor(Math.random() * runeKeys.length)]]);
            round += 1;
            if (round >= rounds) {
              clearInterval(interval);
              glyph.style.transform = '';
              glyph._path.style.removeProperty('stroke');
              glyph._path.setAttribute('d', glyph._original);
            }
          }, scramble);
        }, fade * .5);
      }, delay + glyphIndex * stagger);
    });
    return delay + Math.max(0, glyphs.length - 1) * stagger + rounds * scramble + fade;
  }

  function scheduleLabelReturn(button) {
    if (!button._decoded || button._decoding || button._encoding || !button._shouldReturn) return;
    clearTimeout(button._returnTimer);
    button._returnTimer = setTimeout(function () { encodeLabel(button); }, 7000);
  }

  function encodeLabel(button) {
    clearTimeout(button._returnTimer);
    if (!button._decoded || button._decoding || button._encoding) return;
    button._encoding = true;
    button._decoded = false;
    button.classList.remove('is-decoded');
    button.classList.add('is-encoding');
    var generation = button._generation;
    var lines = button.querySelectorAll('.worldglass-line');
    var instant = reduced.matches;
    var token = button._motionToken = (button._motionToken || 0) + 1;
    var firstDone = encodeLine(lines[0], 0, instant, token, ['#74c58d', '#fffccc', '#fdfd96', '#fffccc', '#74c58d', '#fdfd96', '#74c58d']);
    var secondDone = encodeLine(lines[1], firstDone + (instant ? 0 : 80), instant, token, ['#8c8c8c', '#fffccc', '#fdfd96', '#fffccc', '#8c8c8c', '#fdfd96', '#8c8c8c']);
    setTimeout(function () {
      if (button._generation !== generation || button._motionToken !== token) return;
      button._encoding = false;
      button.classList.remove('is-encoding');
      if (button._decodeAfterEncode || !button._shouldReturn) {
        button._decodeAfterEncode = false;
        decodeLabel(button);
      }
    }, secondDone);
  }

  function eventState(event) {
    var point = rotate(sphere(event.lat, event.lon));
    var screen = project(point);
    var opacity = width < 700
      ? Math.max(0, Math.min(1, (point.z + .12) / .42))
      : Math.max(0, Math.min(1, (point.z + .18) / .34));
    return { event: event, point: point, screen: screen, opacity: opacity };
  }

  function positionMobileRecords(states) {
    if (width >= 700 || !lastMobileLayout) return;
    var inset = 12;
    var gap = 6;
    var groups = { left: [], right: [] };
    states.forEach(function (state, index) {
      var button = dockNodes[index];
      if (!button) return;
      var rect = button.getBoundingClientRect();
      var side = index % 2 ? 'right' : 'left';
      var x = side === 'left'
        ? state.screen.x - rect.width - 24
        : state.screen.x + 24;
      x = Math.max(inset, Math.min(width - inset - rect.width, x));
      if (state.opacity <= .01) {
        button.dataset.side = side;
        button.style.left = '0px';
        button.style.right = 'auto';
        button.style.top = '0px';
        button.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(state.screen.y - rect.height * .5) + 'px,0)';
        return;
      }
      var slot = [-2, -1, 1, 2][Math.floor(index / 2)];
      groups[side].push({
        button: button,
        x: x,
        y: state.screen.y + slot * (rect.height + gap) - rect.height * .5,
        height: rect.height
      });
    });
    Object.keys(groups).forEach(function (side) {
      var items = groups[side].sort(function (a, b) { return a.y - b.y; });
      var cursor = lastMobileLayout.top;
      items.forEach(function (item) {
        item.y = Math.max(cursor, Math.min(lastMobileLayout.bottom - item.height, item.y));
        cursor = item.y + item.height + gap;
      });
      var overflow = cursor - gap - lastMobileLayout.bottom;
      if (overflow > 0) {
        items.forEach(function (item) { item.y -= overflow; });
        for (var index = items.length - 2; index >= 0; index -= 1) {
          items[index].y = Math.min(items[index].y, items[index + 1].y - gap - items[index].height);
        }
      }
      items.forEach(function (item) {
        item.button.dataset.side = side;
        item.button.style.left = '0px';
        item.button.style.right = 'auto';
        item.button.style.top = '0px';
        item.button.style.transform = 'translate3d(' + Math.round(item.x) + 'px,' + Math.round(item.y) + 'px,0)';
      });
    });
  }

  function chooseAssignments(force) {
    if (!force && performance.now() < settleAt) return;
    if (!force && dockNodes.some(function (button) {
      return button.matches(':hover, :focus') || button._decoded || button._decoding || button._encoding;
    })) return;
    var limit = events.length;
    assignments = events.slice(0, limit).map(function (event) { return event.id; });
    dockNodes.forEach(function (button, index) {
      var event = events.find(function (item) { return item.id === assignments[index]; });
      assignLabel(button, event);
    });
    settleAt = performance.now() + 1800;
  }

  function dockLayout() {
    if (width < 700) {
      return events.map(function (_, index) {
        return { y: 0, side: index % 2 ? 'right' : 'left' };
      });
    }
    var narrow = width < 1100;
    var ys = narrow ? [.22, .36, .50, .64] : [.29, .43, .57, .71];
    return [
      { y: ys[0], side: 'left' },
      { y: ys[0], side: 'right' },
      { y: ys[1], side: 'left' },
      { y: ys[1], side: 'right' },
      { y: ys[2], side: 'left' },
      { y: ys[2], side: 'right' },
      { y: ys[3], side: 'left' },
      { y: ys[3], side: 'right' }
    ];
  }

  function positionDocks() {
    var layout = dockLayout();
    while (dockNodes.length < layout.length) {
      var button = makeLabel(dockNodes.length);
      dockNodes.push(button);
      docks.append(button);
    }
    chooseAssignments(true);
    dockNodes.forEach(function (button, index) {
      var slot = layout[index];
      button.hidden = !slot;
      if (!slot) return;
      button.style.removeProperty('left');
      button.style.removeProperty('right');
      button.dataset.side = slot.side;
      button.style.top = Math.round(slot.y * height) + 'px';
    });
    var edgeInset = width < 1100
      ? Math.max(20, Math.min(56, width * .04))
      : Math.max(72, Math.min(128, width * .065));
    var leftWidth = 0;
    var rightWidth = 0;
    dockNodes.forEach(function (button) {
      if (button.hidden) return;
      var measured = button.getBoundingClientRect().width;
      if (button.dataset.side === 'left') leftWidth = Math.max(leftWidth, measured);
      else rightWidth = Math.max(rightWidth, measured);
    });
    dockNodes.forEach(function (button) {
      if (button.hidden) return;
      var measured = button.getBoundingClientRect().width;
      if (button.dataset.side === 'left') button.style.left = Math.round(edgeInset + leftWidth - measured) + 'px';
      else button.style.right = Math.round(edgeInset + rightWidth - measured) + 'px';
    });
    var mobileSafe = null;
    if (width < 700) {
      var rootRect = root.getBoundingClientRect();
      var stage = root.closest('.stage');
      var stageRect = stage ? stage.getBoundingClientRect() : rootRect;
      var stageStyle = stage ? getComputedStyle(stage) : null;
      var topOpaque = stageStyle ? parseFloat(stageStyle.getPropertyValue('--mobile-mist-top-opaque')) || 0 : 0;
      var bottomDepth = stageStyle ? parseFloat(stageStyle.getPropertyValue('--mobile-mist-bottom-depth')) || 0 : 0;
      var viewport = window.visualViewport;
      var viewportTop = viewport ? viewport.offsetTop : 0;
      var viewportBottom = viewportTop + (viewport ? viewport.height : innerHeight);
      var eyes = document.getElementById('eyes');
      var eyesRect = eyes && getComputedStyle(eyes).display !== 'none' ? eyes.getBoundingClientRect() : null;
      var nav = document.querySelector('.footer-nav');
      var navRect = nav ? nav.getBoundingClientRect() : null;
      var safeTop = Math.max(
        0,
        viewportTop - rootRect.top,
        stageRect.top + topOpaque - rootRect.top,
        eyesRect ? eyesRect.bottom + 8 - rootRect.top : 0
      );
      var safeBottom = Math.min(
        height,
        viewportBottom - rootRect.top,
        stageRect.bottom - bottomDepth - rootRect.top,
        navRect ? navRect.top - 12 - rootRect.top : height
      );
      var labelHeights = dockNodes.map(function (button) { return button.getBoundingClientRect().height; });
      var maxLabelHeight = Math.max.apply(Math, labelHeights);
      var usableHeight = Math.max(maxLabelHeight * dockNodes.length, safeBottom - safeTop);
      var labelStep = dockNodes.length > 1
        ? Math.max(maxLabelHeight, (usableHeight - maxLabelHeight) / (dockNodes.length - 1))
        : 0;
      if (safeTop + labelStep * (dockNodes.length - 1) + maxLabelHeight > safeBottom) {
        safeTop = Math.max(0, safeBottom - (labelStep * (dockNodes.length - 1) + maxLabelHeight));
      }
      dockNodes.forEach(function (button, index) {
        button.style.top = Math.round(safeTop + index * labelStep) + 'px';
      });
      mobileSafe = { top: safeTop, bottom: safeBottom };
      root.style.setProperty('--worldglass-safe-top', Math.round(safeTop) + 'px');
      root.style.setProperty('--worldglass-safe-bottom', Math.round(safeBottom) + 'px');
    }
    return {
      leftInner: edgeInset + leftWidth,
      rightInner: width - edgeInset - rightWidth,
      mobileSafe: mobileSafe
    };
  }

  function drawLeader(state, button, time) {
    if (!connectionsIntroducedAt || !button || !button.classList.contains('is-visible')) return;
    var reveal = reduced.matches ? 1 : Math.min(1, Math.max(0, (time - connectionsIntroducedAt) / 360));
    var geometry = leaderGeometry(state, button);
    var active = state.event.id === selectedId || state.event.id === markerHoverId || button.matches(':hover, :focus');
    if (state.opacity > 0) {
      context.save();
      context.globalAlpha = state.opacity * reveal;
      context.beginPath();
      context.moveTo(geometry.markerX, geometry.markerY);
      context.lineTo(geometry.endX, geometry.endY);
      context.setLineDash([3, 7]);
      context.lineDashOffset = active && !reduced.matches ? -(time * .018) : 0;
      context.lineWidth = active ? 1.65 : 1;
      context.strokeStyle = 'rgba(170,170,170,.68)';
      context.stroke();
      context.setLineDash([]);
      context.lineDashOffset = 0;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(geometry.markerX, geometry.markerY, 3, 0, Math.PI * 2);
      context.strokeStyle = '#fff';
      context.stroke();
      if (active) {
        var phase = reduced.matches ? 0 : (time % 1450) / 1450;
        context.beginPath();
        context.arc(geometry.markerX, geometry.markerY, 4 + phase * 11, 0, Math.PI * 2);
        context.globalAlpha = state.opacity * (1 - phase) * .82;
        context.strokeStyle = '#fff';
        context.stroke();
      }
      context.restore();
    }
    var labelOpacity = width < 700 ? state.opacity : (state.event.id === selectedId ? 1 : state.opacity);
    button.style.setProperty('--depth-opacity', labelOpacity.toFixed(3));
    var interactive = state.event.id === selectedId || state.opacity >= .55;
    button.classList.toggle('is-interactive', interactive);
  }

  function leaderGeometry(state, button) {
    var rootRect = root.getBoundingClientRect();
    var labelRect = button.getBoundingClientRect();
    var labelY = labelRect.top - rootRect.top;
    var endX = button.dataset.side === 'left' ? labelRect.right - rootRect.left : labelRect.left - rootRect.left;
    var endY = labelY + labelRect.height * .5;
    return { markerX: state.screen.x, markerY: state.screen.y, endX: endX, endY: endY };
  }

  function markerButtonAt(clientX, clientY) {
    var rootRect = root.getBoundingClientRect();
    var localX = clientX - rootRect.left;
    var localY = clientY - rootRect.top;
    var candidates = assignments.map(function (id, index) {
      var event = events.find(function (item) { return item.id === id; });
      if (!event) return null;
      var state = eventState(event);
      var geometry = leaderGeometry(state, dockNodes[index]);
      return {
        button: dockNodes[index],
        distance: Math.hypot(localX - geometry.markerX, localY - geometry.markerY),
        opacity: state.opacity
      };
    }).filter(function (candidate) {
      return candidate && candidate.button && candidate.opacity >= .55 && candidate.distance <= 14;
    }).sort(function (a, b) { return a.distance - b.distance; });
    if (!candidates.length) return null;
    var nearest = candidates[0].distance;
    var cluster = candidates.filter(function (candidate) { return candidate.distance <= nearest + 2; });
    var selectedIndex = cluster.findIndex(function (candidate) { return candidate.button.dataset.eventId === selectedId; });
    return cluster[(selectedIndex + 1) % cluster.length].button;
  }

  function updateMarkerHover(event) {
    var button = markerButtonAt(event.clientX, event.clientY);
    if (button === markerHoverButton) return;
    if (markerHoverButton) {
      markerHoverButton._shouldReturn = true;
      scheduleLabelReturn(markerHoverButton);
    }
    markerHoverButton = button;
    markerHoverId = button ? button.dataset.eventId : null;
    if (!button) return;
    button._shouldReturn = false;
    clearTimeout(button._returnTimer);
    /* a marker hover identifies its route. translation remains a deliberate click or tap. */
  }

  function clearMarkerHover() {
    if (markerHoverButton) {
      markerHoverButton._shouldReturn = true;
      scheduleLabelReturn(markerHoverButton);
    }
    markerHoverButton = null;
    markerHoverId = null;
  }

  function draw(time) {
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;
    context.beginPath();
    context.arc(centreX, centreY, radius, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(185,185,185,.6)';
    context.stroke();
    for (var lat = -78; lat <= 78; lat += 12) drawPath(latitude(lat), 'rgba(145,145,145,.25)');
    for (var lon = -168; lon < 180; lon += 12) drawPath(longitude(lon), 'rgba(145,145,145,.19)');
    coastRings.forEach(function (ring) {
      drawPath(ring.map(function (coordinate) { return sphere(coordinate[1], coordinate[0]); }), 'rgba(185,185,185,.72)');
    });
    var states = assignments.map(function (id, index) {
      var event = events.find(function (item) { return item.id === id; });
      return event ? eventState(event) : null;
    }).filter(Boolean);
    positionMobileRecords(states);
    states.forEach(function (state, index) {
      drawLeader(state, dockNodes[index], time || 0);
    });
  }

  function animate(time) {
    frameId = 0;
    if (!visible) return;
    var delta = lastFrame ? Math.min(34, time - lastFrame) : 16;
    lastFrame = time;
    var holding = reduced.matches || dockNodes.some(function (button) { return button.matches(':hover, :focus'); });
    if (!dragging) {
      if (!holding && time - lastInteractionAt >= 5000 && Math.abs(velocityX) + Math.abs(velocityY) < .00002) yaw += delta * .000018;
      else {
        yaw += velocityX * delta / 16;
        pitch += velocityY * delta / 16;
        velocityX *= .92;
        velocityY *= .92;
        if (Math.abs(velocityX) < .00001) velocityX = 0;
        if (Math.abs(velocityY) < .00001) velocityY = 0;
      }
    }
    zoom += (targetZoom - zoom) * .16;
    if (Math.abs(targetZoom - zoom) < .0001) zoom = targetZoom;
    radius = baseRadius * zoom;
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
    if (!dragging && !velocityX && !velocityY) chooseAssignments(false);
    if (time >= nextLabelShimmerAt) shimmerEncodedLabel();
    draw(time);
    frameId = requestAnimationFrame(animate);
  }

  function resize(revision) {
    var rect = root.getBoundingClientRect();
    var viewport = window.visualViewport;
    var mobile = rect.width < 700;
    var transientViewport = mobile && (
      (viewport && viewport.scale > 1.01) ||
      document.body.classList.contains('mobile-keyboard-open')
    );
    if (transientViewport && lastMobileLayout) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    var nextDefaultZoom = width < 1100 ? 2.05 : 1;
    if (!zoomInitialised || Math.abs(targetZoom - defaultZoom) < .001) {
      zoom = nextDefaultZoom;
      targetZoom = nextDefaultZoom;
      zoomInitialised = true;
    }
    defaultZoom = nextDefaultZoom;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    centreX = width * .5;
    var rails = positionDocks();
    var safeTop = rails.mobileSafe ? rails.mobileSafe.top : height * .22;
    var safeBottom = rails.mobileSafe ? rails.mobileSafe.bottom : height * .86;
    centreY = (safeTop + safeBottom) * .5;
    var railClearance = width < 1100 ? -24 : 18;
    var horizontalRadius = Math.min(
      centreX - rails.leftInner - railClearance,
      rails.rightInner - centreX - railClearance
    );
    var fittedRadius = Math.min((width - 32) * .5, (safeBottom - safeTop) * .5);
    baseRadius = mobile
      ? Math.max(64, fittedRadius / nextDefaultZoom)
      : Math.max(64, Math.min(width * .25, (safeBottom - safeTop) * .46, horizontalRadius));
    radius = baseRadius * zoom;
    if (mobile) lastMobileLayout = { width: width, height: height, top: safeTop, bottom: safeBottom, revision: revision || 0 };
    draw(performance.now());
  }

  function scheduleResize() {
    layoutRevision += 1;
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(function () {
      layoutFrame = 0;
      var revision = layoutRevision;
      resize(revision);
      if (revision !== layoutRevision) scheduleResize();
    });
  }

  function startIntroduction() {
    if (introductionStarted) return;
    introductionStarted = true;
    root.classList.add('is-introduced');
    if (reduced.matches) {
      introduced = true;
      dockNodes.forEach(function (button) { button.classList.add('is-introduced'); });
      connectionsIntroducedAt = performance.now();
      return;
    }
    introTimers.push(setTimeout(function () {
      dockNodes.forEach(function (button, index) {
        introTimers.push(setTimeout(function () {
          button.classList.add('is-introduced');
          button.classList.remove('rewind-in');
          void button.offsetWidth;
          button.classList.add('rewind-in');
        }, index * 115));
      });
      introduced = true;
      introTimers.push(setTimeout(function () {
        connectionsIntroducedAt = performance.now();
      }, Math.max(0, (dockNodes.length - 1) * 115 + 260)));
    }, 300));
  }

  function touchDistance() {
    var points = Array.from(touchPoints.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  }

  function beginPinch() {
    pinching = true;
    pinchStartDistance = Math.max(1, touchDistance());
    pinchStartZoom = zoom;
    dragging = false;
    pointerId = null;
    moved = true;
    velocityX = 0;
    velocityY = 0;
  }

  function updatePinch() {
    var scale = Math.pow(touchDistance() / pinchStartDistance, 1.22);
    var minimum = defaultZoom * .72;
    var maximum = defaultZoom * 2.15;
    targetZoom = Math.max(minimum, Math.min(maximum, pinchStartZoom * scale));
  }

  function pointerDown(event) {
    lastInteractionAt = performance.now();
    clearMarkerHover();
    if (event.pointerType === 'touch' && width < 700) {
      if (!touchPoints.has(event.pointerId) && touchPoints.size >= 2) return;
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      (event.target.closest('.worldglass-label') || root).setPointerCapture(event.pointerId);
      if (touchPoints.size === 2) {
        beginPinch();
        return;
      }
    }
    pointerId = event.pointerId;
    if (event.pointerType !== 'touch' || width >= 700) {
      (event.target.closest('.worldglass-label') || root).setPointerCapture(pointerId);
    }
    dragging = true;
    moved = false;
    lastX = event.clientX;
    lastY = event.clientY;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    lastTime = performance.now();
    dragThreshold = event.pointerType === 'touch' ? 8 : 3;
    velocityX = 0;
    velocityY = 0;
  }

  function pointerMove(event) {
    lastInteractionAt = performance.now();
    if (event.pointerType === 'touch' && width < 700 && touchPoints.has(event.pointerId)) {
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinching && touchPoints.size >= 2) {
        event.preventDefault();
        updatePinch();
        return;
      }
      if (!dragging) return;
    }
    if (!dragging) {
      if (event.target.closest('button')) clearMarkerHover();
      else updateMarkerHover(event);
      return;
    }
    if (event.pointerId !== pointerId) return;
    var now = performance.now();
    var deltaX = event.clientX - lastX;
    var deltaY = event.clientY - lastY;
    var elapsed = Math.max(8, now - lastTime);
    var interactionZoom = Math.max(.65, zoom / defaultZoom);
    var sensitivity = .007 / Math.pow(interactionZoom, 1.45);
    if (Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > dragThreshold || moved) moved = true;
    yaw += deltaX * sensitivity;
    pitch -= deltaY * sensitivity;
    velocityX = deltaX * sensitivity * 16 / elapsed;
    velocityY = -deltaY * sensitivity * 16 / elapsed;
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = now;
  }

  function pointerUp(event) {
    if (event.pointerType === 'touch' && width < 700) {
      touchPoints.delete(event.pointerId);
      if (pinching || pointerId === null) {
        if (touchPoints.size < 2) pinching = false;
        if (touchPoints.size === 0) {
          pinchStartDistance = 0;
          settleAt = performance.now() + 650;
        }
        return;
      }
    }
    if (event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    if (moved && document.activeElement && document.activeElement.closest('.worldglass-label')) {
      document.activeElement.blur();
    }
    settleAt = performance.now() + 650;
  }

  function pointerCancel(event) {
    moved = true;
    pointerUp(event);
  }

  function wheel(event) {
    event.preventDefault();
    lastInteractionAt = performance.now();
    clearMarkerHover();
    if (event.ctrlKey || event.metaKey) {
      targetZoom = Math.max(.65, Math.min(8, targetZoom * Math.exp(-event.deltaY * .012)));
      return;
    }
    var interactionZoom = Math.max(.65, zoom / defaultZoom);
    var sensitivity = .00032 / Math.pow(interactionZoom, 1.45);
    var limit = .05 / Math.pow(interactionZoom, 1.2);
    velocityX = Math.max(-limit, Math.min(limit, velocityX - event.deltaX * sensitivity));
    velocityY = Math.max(-limit, Math.min(limit, velocityY + event.deltaY * sensitivity));
    settleAt = performance.now() + 650;
  }

  function mount() {
    var screen = document.getElementById('screen-portfolio');
    var stack = document.getElementById('field-report-stack');
    if (!screen || !stack || !window.pfgNaturalEarthLand) return;
    screen.classList.add('worldglass-screen');
    screen.setAttribute('aria-label', 'worldglass');
    var navButton = document.querySelector('[data-tab="portfolio"]');
    if (navButton) {
      navButton.setAttribute('aria-label', 'worldglass');
      var navImage = navButton.querySelector('img');
      if (navImage) navImage.alt = 'worldglass';
    }
    root = document.createElement('section');
    root.className = 'worldglass';
    if (new URLSearchParams(location.search).get('mobileproof') === '1') root.classList.add('is-mobile-proof');
    root.setAttribute('aria-label', 'worldglass, an interactive earth showing goblin event plans');
    root.tabIndex = 0;
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    context = canvas.getContext('2d');
    docks = document.createElement('div');
    docks.className = 'worldglass-docks';
    var records = document.createElement('ol');
    records.className = 'worldglass-records';
    events.forEach(function (event) {
      var item = document.createElement('li');
      item.textContent = event.name + ', ' + event.date + ', ' + event.city;
      records.append(item);
    });
    root.append(canvas, docks, records);
    stack.replaceWith(root);
    var features = window.pfgNaturalEarthLand.features || [];
    features.forEach(function (feature) {
      var geometry = feature.geometry;
      if (!geometry) return;
      if (geometry.type === 'Polygon') geometry.coordinates.forEach(function (ring) { coastRings.push(ring); });
      if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach(function (polygon) { polygon.forEach(function (ring) { coastRings.push(ring); }); });
    });
    root.addEventListener('pointerdown', pointerDown);
    root.addEventListener('pointermove', pointerMove);
    root.addEventListener('pointerup', pointerUp);
    root.addEventListener('pointercancel', pointerCancel);
    root.addEventListener('pointerleave', clearMarkerHover);
    root.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('keydown', function (event) {
      if (!screen.classList.contains('is-active') || !(event.metaKey || event.ctrlKey)) return;
      if (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '0') event.preventDefault();
    }, true);
    root.addEventListener('click', function (event) {
      if (event.target.closest('button') || moved) return;
      var markerButton = markerButtonAt(event.clientX, event.clientY);
      if (markerButton) activateLabel(markerButton);
      else selectedId = null;
    });
    root.addEventListener('keydown', function (event) {
      lastInteractionAt = performance.now();
      if (event.metaKey || event.ctrlKey) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); yaw -= .08; }
      if (event.key === 'ArrowRight') { event.preventDefault(); yaw += .08; }
      if (event.key === 'ArrowUp') { event.preventDefault(); pitch -= .08; }
      if (event.key === 'ArrowDown') { event.preventDefault(); pitch += .08; }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); targetZoom = Math.min(8, targetZoom * 1.2); }
      if (event.key === '-') { event.preventDefault(); targetZoom = Math.max(.65, targetZoom / 1.2); }
      if (event.key === 'Escape') { selectedId = null; document.activeElement.blur(); }
    });
    document.addEventListener('pointermove', function () { lastInteractionAt = performance.now(); }, { passive: true });
    document.addEventListener('touchstart', function () { lastInteractionAt = performance.now(); }, { passive: true });
    addEventListener('resize', scheduleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', scheduleResize);
      window.visualViewport.addEventListener('scroll', scheduleResize);
    }
    addEventListener('pageshow', scheduleResize);
    if (window.ResizeObserver) new ResizeObserver(scheduleResize).observe(root);
    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
      if (visible && !frameId) { lastFrame = 0; frameId = requestAnimationFrame(animate); }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting && !document.hidden;
        if (visible) startIntroduction();
        if (visible && !frameId) { lastFrame = 0; frameId = requestAnimationFrame(animate); }
      }).observe(root);
    } else startIntroduction();
    reduced.addEventListener('change', function () { dockNodes.forEach(encodeLabel); });
    resize(layoutRevision);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleResize);
    scheduleLabelShimmer(2000 + Math.floor(Math.random() * 2000));
    frameId = requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
}());
