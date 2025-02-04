import ClientAgent from './ClientAgent.js';

class Agent {
  constructor(
    gridEngine,
    fieldMapTileMap,
    agent_id,
    bedPosition = { x: 3, y: 3 }
  ) {
    this.gridEngine = gridEngine
    this.fieldMapTileMap = fieldMapTileMap
    this.agent_id = agent_id
    this.sleepiness = 0
    this.bedPosition = bedPosition

    // Change this to `this.agent = new ClientAgent(...)` and adapt ServerAgent to
    // make ClientAgent work.

    this.agent = new ClientAgent(this.agent_id);

    this.initializeServerListener()
    this.initializeMovementStoppedListener()
  }

  initializeServerListener() {
    setTimeout(() => {
      // TODO: make this a nicer looking popover instead of native alert
      if (!window.ai) {
        alert("window.ai not found. Please install at https://windowai.io/");
        return;
      }

      this.nextMove()
    }, 100); // TODO: delay in case window.ai is not injected by the extension fast enough, could remove this later if determined not needed through testing

    // TODO: reimplement this to make local version work again.
    // Right now, the ClientAgent duplicates code from ServerAgent
    // since can't reference code outside src/ folder. Need to
    // refactor to avoid code duplication.
  }

  initializeMovementStoppedListener() {
    this.gridEngine.movementStopped().subscribe((stopper) => {
      this.nextMove()
    })
  }

  getCharacterPosition() {
    return this.gridEngine.getPosition(this.agent_id)
  }

  getSurroundings() {
    const playerPosition = this.getCharacterPosition()
    const { x: playerX, y: playerY } = playerPosition

    const surroundings = {
      up: "walkable",
      down: "walkable",
      left: "walkable",
      right: "walkable",
    }

    const directions = [
      { key: "up", dx: 0, dy: -1 },
      { key: "down", dx: 0, dy: 1 },
      { key: "left", dx: -1, dy: 0 },
      { key: "right", dx: 1, dy: 0 },
    ]

    this.fieldMapTileMap.layers.forEach((layer) => {
      const tilemapLayer = layer.tilemapLayer

      directions.forEach((direction) => {
        const tile = tilemapLayer.getTileAt(
          playerX + direction.dx,
          playerY + direction.dy
        )

        if (tile && tile.properties.ge_collide) {
          surroundings[direction.key] = "wall"
        }
      })
    })

    return surroundings
  }

  moveAndCheckCollision(direction, fieldMapTileMap) {
    const currentPosition = this.gridEngine.getPosition(this.agent_id)
    let nextPosition = { ...currentPosition }

    switch (direction) {
      case "left":
        nextPosition.x -= 1
        break
      case "right":
        nextPosition.x += 1
        break
      case "up":
        nextPosition.y -= 1
        break
      case "down":
        nextPosition.y += 1
        break
      default:
        break
    }

    // Check if the next position has a tile with the 'ge_collide' property set to true
    const collision = fieldMapTileMap.layers.some((layer) => {
      const tile = layer.tilemapLayer.getTileAt(nextPosition.x, nextPosition.y)
      return tile && tile.properties.ge_collide
    })

    if (collision) {
      this.nextMove()
    } else {
      this.gridEngine.move(this.agent_id, direction)
    }
  }

  increaseSleepiness() {
    this.sleepiness = Math.min(this.sleepiness + 1, 10)
  }

  async nextMove() {
    const characterPosition = this.getCharacterPosition()
    // const bedP
    const surroundings = this.getSurroundings()
    this.increaseSleepiness()

    const completion = await this.agent.processMessage({
      type: "requestNextMove",
      agent_id: this.agent_id,
      position: characterPosition,
      surroundings: surroundings,
      sleepiness: this.sleepiness,
    });

    // ws.send(JSON.stringify({ type: 'nextMove', agent_id: agentId, data: completion }));

    let res = { type: 'nextMove', agent_id: this.agentId, data: completion };

    const { data } = res
    switch (data.action.type) {
      case "move":
        this.moveAndCheckCollision(
          data.action.direction,
          this.fieldMapTileMap
        )
        break
      case "navigate":
        this.gridEngine.moveTo(this.agent_id, {
          x: data.action.x,
          y: data.action.y,
        })
        break
      case "sleep":
        const { x, y } = this.getCharacterPosition()
        if (x === this.bedPosition.x && y === this.bedPosition.y) {
          this.sleepiness = 0
        } else {
          console.log(
            `Character ${this.agent_id} tried to sleep out of bed.`
          )
        }
        this.nextMove()
        break
      default:
        setTimeout(() => {
          this.nextMove()
        }, 2000)
    }
  }
}

export default Agent
