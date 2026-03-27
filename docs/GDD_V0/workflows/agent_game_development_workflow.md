# Agent Game Development Workflow: Galaga Clone

This workflow defines the step-by-step implementation process for developing a Galaga-style arcade game based on the technical specifications in the `GameResearch/docs/GDD` directory.

---

## Phase 1: Foundation & Pseudo-CPU Setup
*Goal: Establish the 3-CPU simulation architecture to ensure logic/motion/audio separation.*

1. **Project Initialization**
   - Initialize a Vite/React or Vanilla JS project in the root.
   - Setup directory structure: `/src/core`, `/src/entities`, `/src/physics`, `/src/audio`.
2. **Implement Communication Layer (Shared RAM)**
   - Create a `SharedMemory` class to act as the communication bridge between simulated CPUs.
3. **Core Game Loop (Main CPU)**
   - Implement the global state machine (Attract -> Intro -> Wave -> Fly-in -> Formation -> Attack -> GameOver).
   - Refer to `01_System_Architecture.md: L27-42`.

## Phase 2: Core Player Systems
*Goal: Implement precise 288x224 coordinate system and player controls.*

1. **Player Ship Entity**
   - Handle keyboard input (Left/Right) with pixel-perfect movement (2.0 px/frame).
2. **Shooting Logic (CPU 1)**
   - Verify maximum 2-bullet constraint.
   - Implement fire-rate control and digital input simulation.

## Phase 3: Enemy & Formation System
*Goal: Implement the "Tile vs Sprite" rendering transition.*

1. **Formation Controller (Tile Map)**
   - Create the 8x8 tile-based formation logic for dormant enemies.
   - Implement the sinusoidal collective swaying.
2. **Diving State Transition (Sprite Conversion)**
   - Logic to remove an enemy from the Tile Map and instantiate a Sprite entity at the same coordinates when a "Dive" timer triggers.

## Phase 4: Trajectory & AI Engine
*Goal: Define flight paths for entry and attack phases.*

1. **Trajectory Data Structure**
   - Implement Bezier-based paths or predefined coordinate arrays for the 5 generic "Fly-in" sequences.
2. **Enemy AI State Machine**
   - Implement states: `Entry`, `Formation`, `Dive`, `Escape`.
   - Refer to `01_System_Architecture.md: L44-50`.

## Phase 5: Collision & Scoring
*Goal: Implement performance-optimized collision and accurate score calculation.*

1. **Priority-based Collision (CPU 2)**
   - Detect: Bullet vs Player, Bullet vs Enemy, Enemy vs Player (during Dive).
2. **ScoreManager (CPU 1)**
   - Implement the scoring table from `04_Numeric_and_Balancing.md`.
   - Update HUD in real-time.

## Phase 6: Advanced Gameplay Meta-Systems
*Goal: Implement the signature Tractor Beam and Dual Fighter mechanics.*

1. **Boss Galaga Tractor Beam**
   - Implement the triangular masking detection logic.
   - Manage the `Captured` state for player and enemy synchronization.
2. **Dual Fighter Logic**
   - Handle救援 (Rescue) logic: `Rescue Success` vs `Fighter Destruction` vs `Enemy Conversion`.
   - Update hitbox (30px) and double-fire logic.

## Phase 7: Dynamic Balancing & Polish
*Goal: Finalize the Difficulty Rank system and SFX.*

1. **Difficulty Rank Math**
   - Implement the dynamic rank (0-255) based on player performance.
   - Scale enemy speed and bullet velocity according to rank.
2. **Audio CPU (CPU 3)**
   - Integrate asynchronous SFX triggers for fire, hit, dive, and capture.
   - Implement the 3.072 MHz clock emulation for authentic sound timing.

---

> [!IMPORTANT]
> Always verify the 60FPS fluid motion. If frames drop, optimization must focus on CPU 1 (Logic) vs CPU 2 (Motion) synchronization.
