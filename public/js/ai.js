// Artificial Intelligence (AI) Opponent for Poke Ball
const AI = {
  lastDecisionTime: 0,
  decisionInterval: 0, // frames to wait before recalculating decision (latency simulation)
  targetX: 512,
  action: 'idle',
  jumpDecision: false,

  update(aiPlayer, humanPlayer, ball, difficulty) {
    if (aiPlayer.frozen) return;

    // Set difficulty variables
    let latency = 8; // Medium default
    let mistakeChance = 0.15;
    let predictAhead = 10; // frames to project ball position
    
    if (difficulty === 'easy') {
      latency = 16;
      mistakeChance = 0.35;
      predictAhead = 0; // no prediction
    } else if (difficulty === 'hard') {
      latency = 0; // frame perfect
      mistakeChance = 0.02;
      predictAhead = 22; // advanced path prediction
    }

    // Check decision interval (latency simulation)
    this.decisionInterval++;
    if (latency === 0 || this.decisionInterval >= latency) {
      this.decisionInterval = 0;
      
      // Make a decision
      if (Math.random() < mistakeChance) {
        // AI makes a mistake: targets a random spot or does nothing
        this.targetX = ball.pos.x + (Math.random() - 0.5) * 200;
        this.action = Math.random() < 0.5 ? 'idle' : 'move';
        this.jumpDecision = Math.random() < 0.2;
      } else {
        // AI plays smart: Predicts ball position
        let targetBallX = ball.pos.x;
        let targetBallY = ball.pos.y;
        
        if (predictAhead > 0 && Math.abs(ball.vel.x) > 1) {
          // Project ball path
          targetBallX = ball.pos.x + ball.vel.x * predictAhead;
          targetBallY = ball.pos.y + ball.vel.y * predictAhead + 0.5 * Physics.GRAVITY * 0.75 * predictAhead * predictAhead;
          
          // Clamp prediction to pitch boundaries
          if (targetBallX < 90) targetBallX = 90;
          if (targetBallX > 930) targetBallX = 930;
        }

        this.targetX = targetBallX;
        this.action = 'move';

        // Decide to jump:
        // Jump if ball is in range, above player's head, and moving towards player's side
        const distToBall = Physics.checkCircleCollision(aiPlayer, ball).distance;
        const ballOnAISide = ball.pos.x > 450;
        
        if (ballOnAISide && 
            targetBallY < aiPlayer.pos.y - 10 && 
            targetBallY > aiPlayer.pos.y - 220 && 
            Math.abs(aiPlayer.pos.x - ball.pos.x) < 95) {
          this.jumpDecision = true;
        } else {
          this.jumpDecision = false;
        }

        // Decide to use Special Ability
        if (aiPlayer.energy >= aiPlayer.maxEnergy && ballOnAISide) {
          const ballSpeedTowardsOwnGoal = ball.vel.x < 0; // moving towards P1
          // Pikachu: stun opponent if close or freeze ball
          if (aiPlayer.type === 'pikachu') {
            const distToHuman = Physics.checkCircleCollision(aiPlayer, humanPlayer).distance;
            if (distToHuman < 280 || distToBall < 180) {
              aiPlayer.useSpecial(ball, humanPlayer, window.gameParticles);
            }
          }
          // Charmander: super fire blast if ball is close
          else if (aiPlayer.type === 'charmander' && distToBall < 140) {
            aiPlayer.useSpecial(ball, humanPlayer, window.gameParticles);
          }
          // Squirtle: push ball away if it gets too close to own goal
          else if (aiPlayer.type === 'squirtle' && ball.pos.x > 750 && distToBall < 250) {
            aiPlayer.useSpecial(ball, humanPlayer, window.gameParticles);
          }
          // Bulbasaur: whip ball if in front
          else if (aiPlayer.type === 'bulbasaur' && distToBall < 220) {
            aiPlayer.useSpecial(ball, humanPlayer, window.gameParticles);
          }
        }
      }
    }

    // Execute the decisions
    if (this.action === 'move') {
      const buffer = 15; // margin of error to stop jittering
      if (aiPlayer.pos.x < this.targetX - buffer) {
        aiPlayer.moveRight();
      } else if (aiPlayer.pos.x > this.targetX + buffer) {
        aiPlayer.moveLeft();
      }
    }

    if (this.jumpDecision) {
      aiPlayer.jump();
      this.jumpDecision = false; // reset jump toggle
    }
  }
};
