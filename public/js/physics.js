// 2D Physics Vector & Collision helpers for Poke Ball
const Physics = {
  // Gravity constant
  GRAVITY: 0.5,
  
  // Friction constant on ground
  FRICTION: 0.98,
  
  // Elasticity of the ball
  BALL_BOUNCE: 0.8,
  
  // Max vertical speed
  TERMINAL_VELOCITY: 12,

  // Vector 2D helper functions
  Vector2D: class {
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    
    add(v) {
      this.x += v.x;
      this.y += v.y;
      return this;
    }

    sub(v) {
      this.x -= v.x;
      this.y -= v.y;
      return this;
    }

    mult(n) {
      this.x *= n;
      this.y *= n;
      return this;
    }

    div(n) {
      this.x /= n;
      this.y /= n;
      return this;
    }

    mag() {
      return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize() {
      const m = this.mag();
      if (m !== 0) this.div(m);
      return this;
    }

    dot(v) {
      return this.x * v.x + this.y * v.y;
    }

    copy() {
      return new Physics.Vector2D(this.x, this.y);
    }
  },

  // Circle to Circle collision check
  checkCircleCollision(c1, c2) {
    const dx = c2.pos.x - c1.pos.x;
    const dy = c2.pos.y - c1.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = c1.radius + c2.radius;
    
    return {
      collided: distance < minDist,
      distance: distance,
      overlap: minDist - distance,
      normal: {
        x: distance > 0 ? dx / distance : 1,
        y: distance > 0 ? dy / distance : 0
      }
    };
  },

  // Handle elastic collision between two circles (like Ball & Player)
  resolveCircleCollision(c1, c2, restitution = 1.0) {
    const collision = this.checkCircleCollision(c1, c2);
    if (!collision.collided) return;

    // Push circles away from each other to prevent stuck behavior (overlap resolution)
    const pushForce = collision.normal;
    // We apply push based on whether elements are static or moveable.
    // For our game, players can push the ball but the ball can't push the player much.
    // We will separate them based on their inverse mass. Let's assume c1 is player and c2 is ball.
    // Ball gets pushed away.
    if (c1.isPlayer && !c2.isPlayer) {
      // Push ball out of player
      c2.pos.x += pushForce.x * collision.overlap;
      c2.pos.y += pushForce.y * collision.overlap;
    } else if (!c1.isPlayer && c2.isPlayer) {
      c1.pos.x -= pushForce.x * collision.overlap;
      c1.pos.y -= pushForce.y * collision.overlap;
    } else {
      // Both moveable (e.g. Player vs Player)
      c1.pos.x -= pushForce.x * collision.overlap * 0.5;
      c1.pos.y -= pushForce.y * collision.overlap * 0.5;
      c2.pos.x += pushForce.x * collision.overlap * 0.5;
      c2.pos.y += pushForce.y * collision.overlap * 0.5;
    }

    // Relative velocity
    const rvx = c2.vel.x - c1.vel.x;
    const rvy = c2.vel.y - c1.vel.y;

    // Calculate relative velocity along collision normal
    const velAlongNormal = rvx * collision.normal.x + rvy * collision.normal.y;

    // Do not resolve if velocities are separating
    if (velAlongNormal > 0) return;

    // Calculate impulse scalar
    // For arcade physics, we'll customize how much kick strength is transferred.
    // If player is moving towards the ball, we transfer their speed + an extra kick boost!
    let impulse = -(1 + restitution) * velAlongNormal;
    
    // Mass: Player has high mass, Ball has low mass.
    // Let's assume mass ratios: Player = 5, Ball = 1
    const m1 = c1.isPlayer ? 8 : 1;
    const m2 = c2.isPlayer ? 8 : 1;
    impulse /= (1/m1 + 1/m2);

    // Apply impulse to each circle
    c1.vel.x -= (1/m1) * impulse * collision.normal.x;
    c1.vel.y -= (1/m1) * impulse * collision.normal.y;
    c2.vel.x += (1/m2) * impulse * collision.normal.x;
    c2.vel.y += (1/m2) * impulse * collision.normal.y;

    // If player is kicking or moving fast towards the ball, add extra force!
    if (c1.isPlayer && !c2.isPlayer) {
      // Add player velocity contribution
      const playerSpeed = Math.sqrt(c1.vel.x * c1.vel.x + c1.vel.y * c1.vel.y);
      if (playerSpeed > 1) {
        c2.vel.x += c1.vel.x * 0.5;
        c2.vel.y += c1.vel.y * 0.3 - 1.5; // kick slightly upwards
      }
    }
  },

  // Circle vs AABB (Bounding Box) collision check (e.g. goals, bounds)
  checkAABBCollision(rect, circle) {
    // Find the closest point on the rectangle to the circle's center
    const closestX = Math.max(rect.x, Math.min(circle.pos.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.pos.y, rect.y + rect.height));

    // Calculate distance between closest point and circle center
    const dx = circle.pos.x - closestX;
    const dy = circle.pos.y - closestY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return {
      collided: distance < circle.radius,
      closestX: closestX,
      closestY: closestY,
      dx: dx,
      dy: dy,
      distance: distance,
      overlap: circle.radius - distance
    };
  },

  // Resolve Circle vs AABB collision
  resolveAABBCollision(rect, circle, restitution = 0.8) {
    const collision = this.checkAABBCollision(rect, circle);
    if (!collision.collided) return false;

    // Push out of collision
    if (collision.distance === 0) {
      // Circle center is inside rectangle, push it upwards
      circle.pos.y -= circle.radius;
      circle.vel.y = -Math.abs(circle.vel.y) * restitution;
    } else {
      const normalX = collision.dx / collision.distance;
      const normalY = collision.dy / collision.distance;

      circle.pos.x += normalX * collision.overlap;
      circle.pos.y += normalY * collision.overlap;

      // Reflect velocity along collision normal
      const dotProduct = circle.vel.x * normalX + circle.vel.y * normalY;
      circle.vel.x -= 2 * dotProduct * normalX * restitution;
      circle.vel.y -= 2 * dotProduct * normalY * restitution;
    }
    
    return true;
  }
};
