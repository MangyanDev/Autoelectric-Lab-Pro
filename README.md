<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Virtual ECU Lab

Virtual ECU Lab is a professional ECU bench simulation and diagnostic training platform. It is intended to help users explore automotive electrical circuits, diagnose faults, and work with virtual test instruments.

## Project Context

The simulation is designed around deterministic physical modeling. Circuit behavior—including voltages, currents, and waveforms—should be produced by the Modified Nodal Analysis (MNA) solver and the physical component models, not by hardcoded multipliers or fabricated results.

### Architecture and contribution principles

- Keep circuit physics, component models, and fault behavior in `src/sim/`.
- Keep UI and interaction code outside `src/sim/`; the simulation engine should remain platform-agnostic.
- Prefer small, incremental changes that preserve a working application.
- When changing circuit topology or fault behavior, maintain consistency with the physical circuit model and MNA solver.
- When debugging, trace symptoms through the solver, fault injection, instruments, and simulation state rather than masking results in the UI.
- Favor targeted performance and robustness improvements over speculative rewrites.

### Existing systems to preserve

Unless a change is explicitly requested, contributions should preserve the existing capabilities, including:

- MNA solver and sensor/actuator physical models
- Fault injection
- Digital multimeter (DMM), oscilloscope, and power supply
- ECU pinout library and triple-view
- Repair knowledge base and PCB hotspots
- Wiring canvas and simulation speed control
- OBD-II / scanner monitor

## Run Locally

**Prerequisite:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set `GEMINI_API_KEY` in [`.env.local`](.env.local) to your Gemini API key.
3. Start the development server:
   ```bash
   npm run dev
   ```

View the app in AI Studio: https://ai.studio/apps/4053ff7d-9ace-4b02-bde1-ef4cebdbc4d6
