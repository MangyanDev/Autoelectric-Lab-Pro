import { EcuPin } from '../types/ecu';

export type LabTab = 'BENCH_LAB' | 'WIRING_DIAGRAM' | 'THREE_D_TWIN' | 'ECU_PINOUT' | 'OSCILLOSCOPE' | 'PCB_SCANNER' | 'REPAIR_GUIDE';

export interface CommandExecutionResult {
  matched: boolean;
  actionDescription: string;
  spokenReply: string;
}

export function parseAndExecuteVoiceCommand(
  transcript: string,
  pins: EcuPin[],
  actions: {
    setVoltage: (volts: number) => void;
    resetLab: () => void;
    attachProbeToPin: (pinId: string, label: string) => void;
    setPowerSupplyOutput: (enabled: boolean) => void;
    switchTab: (tab: LabTab) => void;
  }
): CommandExecutionResult {
  const text = transcript.trim().toLowerCase();

  // 1. Set Voltage e.g. "set voltage to 12 volts", "change voltage to 5V", "set power supply to 13.8"
  const voltageMatch = text.match(/(?:set|change)\s+(?:power\s+supply\s+)?voltage\s+(?:to\s+)?([0-9]+(?:\.[0-9]+)?)/i) ||
                       text.match(/voltage\s+([0-9]+(?:\.[0-9]+)?)\s*(?:v|volts?)?/i) ||
                       text.match(/set\s+([0-9]+(?:\.[0-9]+)?)\s*(?:v|volts?)/i);

  if (voltageMatch) {
    const volts = parseFloat(voltageMatch[1]);
    if (!isNaN(volts) && volts >= 0 && volts <= 30) {
      actions.setVoltage(volts);
      return {
        matched: true,
        actionDescription: `Set power supply voltage to ${volts.toFixed(1)}V`,
        spokenReply: `Power supply voltage adjusted to ${volts.toFixed(1)} volts.`,
      };
    }
  }

  // 2. Reset Lab e.g. "reset lab", "reset circuit", "reset bench"
  if (/reset\s+(?:lab|circuit|bench|session)/i.test(text) || /restart\s+(?:lab|bench)/i.test(text)) {
    actions.resetLab();
    return {
      matched: true,
      actionDescription: 'Reset laboratory to pristine factory state',
      spokenReply: 'Laboratory reset to initial factory bench state.',
    };
  }

  // 3. Power Supply Toggle e.g. "turn power supply on", "disable power supply", "turn output off"
  if (/(?:turn\s+(?:power\s+supply\s+)?|power\s+)(on|enable)/i.test(text)) {
    actions.setPowerSupplyOutput(true);
    return {
      matched: true,
      actionDescription: 'Enabled bench power supply output',
      spokenReply: 'Bench power supply output enabled.',
    };
  }
  if (/(?:turn\s+(?:power\s+supply\s+)?|power\s+)(off|disable)/i.test(text) || /cut\s+power/i.test(text)) {
    actions.setPowerSupplyOutput(false);
    return {
      matched: true,
      actionDescription: 'Disabled bench power supply output',
      spokenReply: 'Bench power supply output disabled.',
    };
  }

  // 4. Attach Probe to Pin e.g. "attach probe to pin 7", "probe pin 15", "connect red probe to pin 4"
  const pinMatch = text.match(/(?:attach|connect)?\s*(?:red\s+)?probe\s+(?:to\s+)?(?:pin\s+)?([0-9]+)/i) ||
                   text.match(/probe\s+pin\s+([0-9]+)/i) ||
                   text.match(/pin\s+([0-9]+)\s+probe/i);

  if (pinMatch) {
    const pinNumStr = pinMatch[1];
    const pinNum = parseInt(pinNumStr, 10);
    const targetPin = pins.find((p) => p.pinNumber === pinNum || p.id.endsWith(`-${pinNum}`));
    if (targetPin) {
      actions.attachProbeToPin(targetPin.id, `${targetPin.label} (#${targetPin.pinNumber})`);
      return {
        matched: true,
        actionDescription: `Attached DMM red probe to Pin #${targetPin.pinNumber} (${targetPin.label})`,
        spokenReply: `Attached multimeter probe to pin ${targetPin.pinNumber}, ${targetPin.label}.`,
      };
    } else {
      return {
        matched: true,
        actionDescription: `Pin #${pinNum} not found in ECU pinout map`,
        spokenReply: `Pin number ${pinNum} was not found in the ECU pinout library.`,
      };
    }
  }

  // 5. Switch Tabs / Open Workspace Views
  if (/open\s+(?:oscilloscope|scope)/i.test(text)) {
    actions.switchTab('OSCILLOSCOPE');
    return { matched: true, actionDescription: 'Opened Oscilloscope workspace', spokenReply: 'Switching to digital oscilloscope.' };
  }
  if (/open\s+(?:pcb\s+scanner|scanner|board)/i.test(text)) {
    actions.switchTab('PCB_SCANNER');
    return { matched: true, actionDescription: 'Opened PCB Scanner workspace', spokenReply: 'Switching to PCB vision scanner.' };
  }
  if (/open\s+(?:repair\s+guide|manuals?|knowledge\s+base)/i.test(text)) {
    actions.switchTab('REPAIR_GUIDE');
    return { matched: true, actionDescription: 'Opened ECU Repair Knowledge Base', spokenReply: 'Opening ECU repair knowledge base and diagnostic manuals.' };
  }
  if (/open\s+(?:pinout|ecu\s+pins?)/i.test(text)) {
    actions.switchTab('ECU_PINOUT');
    return { matched: true, actionDescription: 'Opened ECU Pinout Library', spokenReply: 'Opening ECU connector pinout library.' };
  }
  if (/open\s+(?:wiring|diagram|canvas)/i.test(text)) {
    actions.switchTab('WIRING_DIAGRAM');
    return { matched: true, actionDescription: 'Opened Wiring Harness Canvas', spokenReply: 'Opening interactive wiring canvas.' };
  }
  if (/open\s+(?:3d\s+bench|twin|hardware)/i.test(text)) {
    actions.switchTab('THREE_D_TWIN');
    return { matched: true, actionDescription: 'Opened 3D Bench Twin workspace', spokenReply: 'Switching to Three D bench hardware twin.' };
  }
  if (/open\s+(?:bench|lab|simulator)/i.test(text)) {
    actions.switchTab('BENCH_LAB');
    return { matched: true, actionDescription: 'Opened Main Bench Lab', spokenReply: 'Returning to main bench laboratory.' };
  }

  return {
    matched: false,
    actionDescription: '',
    spokenReply: '',
  };
}
