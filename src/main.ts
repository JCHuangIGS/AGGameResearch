import { GameApp } from './core/GameApp';

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('game-container');
  if (container) {
    const app = new GameApp(container);
    await app.init();
  }
});
