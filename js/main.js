var mouseMoveTimeout = 3000; // Time for lack of mouse movement to 'release' grip on cloth
var mouseMovingTimer = mouseMoveTimeout;
var mouseAffectsCloth = true;
var accuracy = 5;
var gravity = 40; // Amount of force pulling the lattice back to its original structure
var distortWidth = Math.sin(Math.PI / 3);
var tearDist = 9999999999; //Impossible to rip
var friction = 0.99; // Amount the mouse 'pulls' on the lattice as it moves
var bounce = 0.5;
var distanceOfMouseInfluence = 30; // distance of mouse influence
var distanceOfMouseInfluenceSquared = distanceOfMouseInfluence * distanceOfMouseInfluence;
var extendBeyondEdge = 1; // Extend by this many hexagons beyond the edge
var lineThickness = 2; // Thickness of lines
var lwgLogoThickness = 0.303797; // The thickness of the LWG logo (1 would extend to the centre of the hexagon)
var hasResized = true;
var freezeWidth;
var freezeHeight;
var touchPoints;
var touchAffectsCloth = false;

// Hexagons resize at different screen widths and heights
var minHexWidth = 64; // when smallest of width or height is below...
var atBelow = 320; // pixels
var maxHexWidth = 100; // when smallest of width or height is above...
var atAbove = 950; // pixels

var backgroundColor = '#0076a6';
var lineColor = '#097faf';
var xcoord, ycoord;
var hexWidth, hexHeight, hexEdgeLength;
var numX, numY; // Number of X and Y coordinates
var parallax; // Displacement from parallax from 0 (scrolled upward) through 0.5 (centred) to 1 (scrolled downward)

var cloth;

var mouse = {
  cut: 8,
  influence: distanceOfMouseInfluenceSquared,
  down: false,
  button: 1,
  x: 0,
  y: 0,
  px: 0,
  py: 0
};

class TouchPoint {
  constructor (x, y) {
    this.x = x; // x position
    this.y = y; // y position
    this.px = x;
    this.py = y;
  }
}

class Point {
  constructor (x, y) {
    this.x = x; // x position
    this.y = y; // y position
    this.ox = x; // original x position (gravity pulls toward this point)
    this.oy = y; // original y position (gravity pulls toward this point)
    this.px = x; // force applied to x from mouse x
    this.py = y; // force applied to y from mouse y
    this.vx = 0; // velocity in x direction
    this.vy = 0; // velocity in y direction
    this.pinX = null;
    this.pinY = null;

    this.constraints = [];
  }

  update (delta) {
    if (this.pinX && this.pinY) return this;

    if(touchAffectsCloth) {
      for(i = 0; i < touchPoints.length; i++) {
      var dx = this.x - touchPoints[i].x;
      var dy = this.y - touchPoints[i].y;
      var dist = dx * dx + dy * dy;

      if (dist < mouse.influence) {
        this.px = this.x - (touchPoints[i].x - touchPoints[i].px);
        this.py = this.y - (touchPoints[i].y - touchPoints[i].py);
      }
    }
  }

    if (mouseAffectsCloth && mouseMovingTimer > 0) {
      // Decrement timer
      mouseMovingTimer -= 1;
      var dx = this.x - mouse.x;
      var dy = this.y - mouse.y;
      var dist = dx * dx + dy * dy;

      if (dist < mouse.influence) {
        this.px = this.x - (mouse.x - mouse.px);
        this.py = this.y - (mouse.y - mouse.py);
      }
    }

    this.addForce(gravity * (this.ox - this.x), gravity * (this.oy - this.y));

    var nx = this.x + (this.x - this.px) * friction + this.vx * delta;
    var ny = this.y + (this.y - this.py) * friction + this.vy * delta;

    this.px = this.x;
    this.py = this.y;

    this.x = nx;
    this.y = ny;

    this.vy = this.vx = 0;
/*
    if (this.x >= width) {
      this.px = width + (width - this.px) * bounce;
      this.x = width;
    } else if (this.x <= 0) {
      this.px *= -1 * bounce;
      this.x = 0;
    }

    if (this.y >= height) {
      this.py = height + (height - this.py) * bounce;
      this.y = height;
    } else if (this.y <= 0) {
      this.py *= -1 * bounce;
      this.y = 0;
    }
*/
    return this;
  }

  draw () {
    var i = this.constraints.length;
    while (i--) this.constraints[i].draw();
  }

  resolve () {
    if (this.pinX && this.pinY) {
      this.x = this.pinX;
      this.y = this.pinY;
      return;
    }

    this.constraints.forEach((constraint) => constraint.resolve());
  }

  attach (point) {
    this.constraints.push(new Constraint(this, point));
  }

  free (constraint) {
    this.constraints.splice(this.constraints.indexOf(constraint), 1);
  }

  addForce (x, y) {
    this.vx += x;
    this.vy += y;
  }

  pin (pinx, piny) {
    this.pinX = pinx;
    this.pinY = piny;
  }
}

class Constraint {
  constructor (p1, p2, isLogo) {
    this.isLogo = isLogo; // Determines if Constraint is 
    this.p1 = p1;
    this.p2 = p2;
    this.length = hexHeight / 2;
  }

  resolve () {
    var dx = this.p1.x - this.p2.x;
    var dy = this.p1.y - this.p2.y;
    var dist = sqrt(dx * dx + dy * dy);

    if (dist < this.length) return;

    var diff = (this.length - dist) / dist;

    var mul = diff * 0.5 * (1 - this.length / dist);

    var px = dx * mul;
    var py = dy * mul;

    !this.p1.pinX && (this.p1.x += px);
    !this.p1.pinY && (this.p1.y += py);
    !this.p2.pinX && (this.p2.x -= px);
    !this.p2.pinY && (this.p2.y -= py);

    return this;
  }

  draw () {
    stroke(lineColor);
    strokeWeight(lineThickness);
    line(this.p1.x, this.p1.y, this.p2.x, this.p2.y);
  }
}

class Cloth {
  constructor (free) {
    this.points = [];

    // Create initial hexagon coordinates as points
    for(var y = 0; y < numY; y++) {
      for(var x = 0; x < numX; x++) {
        var point = new Point(x * hexWidth / 2, (y * hexHeight * 3 / 4) + (hexHeight / 4) * ((x + (y % 2)) % 2));
        //!free && y === 0 && point.pin(point.x, point.y);
        // Attach those points to each other as constraints
        if(x !== 0) {
          point.attach(this.points[this.points.length - 1]);
        }
        if(y !== 0 && ((x + (y % 2)) % 2) == 0) {
          point.attach(this.points[x + (y - 1) * (numX)]);
        }
        this.points.push(point);
      }
    }
  }

  update (delta) {
    var i = accuracy;

    while (i--) {
      this.points.forEach((point) => {
        point.resolve();
      })
    }

    this.points.forEach((point) => {
      point.update(delta * delta).draw();
    })
    // Draw LWG logo inside hexagons
    //if(hasResized) {drawLWGLogos();}
  }
}

function setup() {
  //generateHexagons();
  freezeWidth = windowWidth;
  freezeHeight = windowHeight;
  determineNumberOfHexagons();
  createCanvas(freezeWidth + 2 * extendBeyondEdge * hexWidth, freezeHeight + 2 * extendBeyondEdge * (4 / 3) * hexHeight);
  $("#defaultCanvas0").css({
    "position": "relative",
    "left": (- extendBeyondEdge) * hexWidth + "px",
    "top": (- extendBeyondEdge) * (4 / 3) * hexHeight + "px"
  });
  cloth = new Cloth();
  touchPoints = [];
}

function determineNumberOfHexagons() {
  var smallestOfWidthHeight = freezeWidth < freezeHeight ? freezeWidth : freezeHeight;
  hexWidth = freezeWidth / round(freezeWidth / map(smallestOfWidthHeight, atBelow, atAbove, minHexWidth, maxHexWidth, true));
  hexHeight = hexWidth / sin(PI / 3);
  hexEdgeLength = hexHeight / 2;
  numX = ceil(2 * freezeWidth / hexWidth) + 1 + extendBeyondEdge * 4;
  numY = ceil((4 / 3) * freezeHeight / hexHeight) + 1 + extendBeyondEdge * 2;
}

function drawLWGLogos() {
  var oddEven; // shift top left of hexagon one to the right on odd lines
  for(var y = 0; y < numY - 1; y++) {
    if(y % 2 == 1) {
      oddEven = 1;
    } else {
      oddEven = 0;
    }
    for(var x = 1; x < numX - 2; x+=2) {
      // Find six points of hexagon and centroid (i.e. central point)
      var xtl = cloth.points[y * numX + x + oddEven].x; // top left x
      var ytl = cloth.points[y * numX + x + oddEven].y; // top left y
      var xtc = cloth.points[y * numX + x + 1 + oddEven].x; // top centre x
      var ytc = cloth.points[y * numX + x + 1 + oddEven].y; // top centre y
      var xtr = cloth.points[y * numX + x + 2 + oddEven].x; // top right x
      var ytr = cloth.points[y * numX + x + 2 + oddEven].y; // top right y
      var xbl = cloth.points[(y + 1) * numX + x + oddEven].x; // bottom left x
      var ybl = cloth.points[(y + 1) * numX + x + oddEven].y; // bottom left y
      var xbc = cloth.points[(y + 1) * numX + x + 1 + oddEven].x; // bottom centre x
      var ybc = cloth.points[(y + 1) * numX + x + 1 + oddEven].y; // bottom centre y
      var xbr = cloth.points[(y + 1) * numX + x + 2 + oddEven].x; // bottom right x
      var ybr = cloth.points[(y + 1) * numX + x + 2 + oddEven].y; // bottom right y
      var xcentroid = (xtl + xtc + xtr + xbl + xbc + xbr) / 6;
      var ycentroid = (ytl + ytc + ytr + ybl + ybc + ybr) / 6;

      stroke(lineColor);
      strokeWeight(lineThickness);
      // Draw left line in logo
      line(xtl * (1 - lwgLogoThickness) + (xtc * lwgLogoThickness), ytl * (1 - lwgLogoThickness) + (ytc * lwgLogoThickness), xbl * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ybl * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness));
      // Draw bottom left line in logo
      line(xbl * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ybl * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness), xbc * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ybc * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness));
      // Draw bottom right line in logo
      line(xbc * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ybc * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness), xbr * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ybr * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness));
      // Draw bottom right to centroid line in logo
      line(xcentroid, ycentroid, xbr, ybr);
      // Draw right line in logo
      line(xbr * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ybr * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness), xtr * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ytr * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness));
      // Draw top right joining line in logo
      line(xtr * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ytr * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness), xtr, ytr);
      // Draw top right line in logo
      line(xtr * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ytr * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness), xtc * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ytc * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness));
      // Draw top left line in logo
      line(xtc * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ytc * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness), (xtl * (1 - lwgLogoThickness) + (xtc * lwgLogoThickness)) * (1 - lwgLogoThickness) + (xbl * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness)) * lwgLogoThickness, (ytl * (1 - lwgLogoThickness) + (ytc * lwgLogoThickness)) * (1 - lwgLogoThickness) + (ybl * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness)) * lwgLogoThickness);
      // Draw top left line in moustache of logo
      line(xbl * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness), ybl * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness), xcentroid, ycentroid);
      // Draw central horizontal line in moustache of logo
      line(xcentroid * (1 - lwgLogoThickness) + (xbc * lwgLogoThickness), ycentroid * (1 - lwgLogoThickness) + (ybc * lwgLogoThickness), xcentroid, ycentroid);
      // Draw bottom left line in moustache of logo
      line(xcentroid * (1 - lwgLogoThickness) + (xbc * lwgLogoThickness), ycentroid * (1 - lwgLogoThickness) + (ybc * lwgLogoThickness), (xbl * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness)) * (1 - (lwgLogoThickness / (1 - lwgLogoThickness))) + (xbc * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness)) * lwgLogoThickness / (1 - lwgLogoThickness), (ybl * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness)) * (1 - (lwgLogoThickness / (1 - lwgLogoThickness))) + (ybc * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness)) * lwgLogoThickness / (1 - lwgLogoThickness));
      // Draw bottom right line in moustache of logo
      line(xcentroid * (1 - lwgLogoThickness) + (xbc * lwgLogoThickness), ycentroid * (1 - lwgLogoThickness) + (ybc * lwgLogoThickness), (xbr * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness)) * (1 - (lwgLogoThickness / (1 - lwgLogoThickness))) + (xbc * (1 - lwgLogoThickness) + (xcentroid * lwgLogoThickness)) * lwgLogoThickness / (1 - lwgLogoThickness), (ybr * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness)) * (1 - (lwgLogoThickness / (1 - lwgLogoThickness))) + (ybc * (1 - lwgLogoThickness) + (ycentroid * lwgLogoThickness)) * lwgLogoThickness / (1 - lwgLogoThickness));
    }
  }
}

/*
function generateHexagons() {
  var smallestOfWidthHeight = width < height ? width : height;
  hexWidth = width / round(width / map(smallestOfWidthHeight, atBelow, atAbove, minHexWidth, maxHexWidth, true));
  hexHeight = hexWidth / sin(PI / 3);
  hexEdgeLength = hexHeight / 2;
  numX = ceil(2 * width / hexWidth) + 1;
  numY = ceil((4 / 3) * height / hexHeight) + 1;
  xcoord = new Array(numX);
  ycoord = new Array(numX);

  for(var x = 0; x < numX; x++) {
    xcoord[x] = new Array(numY);
    ycoord[x] = new Array(numY);
  }
  // Create initial hexagon coordinates as points
  for(var y = 0; y < numY; y++) {
    for(var x = 0; x < numX; x++) {
      xcoord[x][y] = x * hexWidth / 2;
      ycoord[x][y] = (y * hexHeight * 3 / 4) + (hexHeight / 4) * ((x + (y % 2)) % 2);
    }
  }
}
*/

function draw() {
  constrain(parallax, 0, 1);
  if(parallax < 0.5) {
    translate(0, (parallax - 0.5) * 2 * (((numY - 1) * 3) + 1) * hexHeight / 4);
  } else {
    translate(0, (parallax - 0.5) * 2 * height);
  }
  /*
  drawHorizontals();
  drawVerticals();
  */
  background(backgroundColor);
  cloth.update(0.016);
}

/*
function drawHorizontals() {
  stroke(lineColor);
  strokeWeight(1);
  for(var y = 0; y < numY; y++) {
    for(var x = 0; x < numX - 1; x++) {
      line(xcoord[x][y],ycoord[x][y],xcoord[x + 1][y],ycoord[x + 1][y]);
    }
  }
}

function drawVerticals() {
  stroke(lineColor);
  strokeWeight(1);
  for(var y = 0; y < numY - 1; y++) {
    for(var x = (y + 1) % 2; x < numX; x = x + 2) {
      line(xcoord[x][y],ycoord[x][y],xcoord[x][y + 1],ycoord[x][y + 1]);
    }
  }
}
*/

function windowResized() {
  hasResized = false;
  freezeWidth = windowWidth;
  freezeHeight = windowHeight;
  determineNumberOfHexagons();
  resizeCanvas(freezeWidth + 2 * extendBeyondEdge * hexWidth, freezeHeight + 2 * extendBeyondEdge * (4 / 3) * hexHeight);
  $("#defaultCanvas0").css({
    "position": "relative",
    "left": (- extendBeyondEdge) * hexWidth + "px",
    "top": (- extendBeyondEdge) * (4 / 3) * hexHeight + "px"
  });
  cloth = new Cloth();
  hasResized = true;
}

function mouseMoved() {
  // Reset timer
  mouseMovingTimer = mouseMoveTimeout;
  mouse.px = mouse.x;
  mouse.py = mouse.y;
  mouse.x = mouseX;
  mouse.y = mouseY;
}

function touchStarted() {
  initialiseTouches();
  return false;
}

function touchEnded() {
  initialiseTouches();
}

function touchMoved() {
  if(touchPoints.length > 0 && touchPoints.length === touches.length) {
    console.log(touchPoints.length);
    touchAffectsCloth = true;
    for(i = 0; i < touchPoints.length; i++) {
      touchPoints[i].px = touchPoints[i].x;
      touchPoints[i].py = touchPoints[i].y;
      touchPoints[i].x = touches[i].x;
      touchPoints[i].y = touches[i].y;
    }
  }
}

function initialiseTouches() {
  touchAffectsCloth = false;
  touchPoints = new Array(touches.length);
  for(i = 0; i < touchPoints.length; i++) {
    touchPoints[i] = new TouchPoint(touches[i].x, touches[i].y);
    touchPoints[i].px = touches[1].x;
    touchPoints[i].py = touches[1].y;
    touchPoints[i].x = touches[1].x;
    touchPoints[i].y = touches[1].y;
  }
}