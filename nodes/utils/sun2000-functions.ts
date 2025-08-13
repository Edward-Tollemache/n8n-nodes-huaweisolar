/**
 * Huawei SUN2000 Inverter Functions
 * 
 * Simple implementation for reading data from SUN2000 inverters via Modbus TCP
 * Based on modbus-slave.md documentation - using remapped register access
 */

import { HuaweiModbusClient, combineU32RegistersLE, combineI32RegistersLE, toSignedInt16 } from './modbus-utils';

export interface SUN2000InverterData {
	unitId: number;
	deviceName?: string;
	
	// Device Information (from direct registers)
	model?: string;              // Device model name
	serialNumber?: string;       // Device serial number
	firmwareVersion?: string;    // Firmware version
	numberOfStrings?: number;    // Number of PV strings
	ratedPower?: number;         // Rated power (kW)
	
	// Basic Power Data
	activePower?: number;        // Active power (kW)
	reactivePower?: number;      // Reactive power (kVar)
	inputPower?: number;         // Input power (kW)
	powerFactor?: number;        // Power factor
	efficiency?: number;         // Inverter efficiency (%)
	
	// Enhanced Power & Energy
	peakPowerToday?: number;     // Peak power today (kW)
	dailyEnergyYield?: number;   // Daily energy yield (kWh)
	totalEnergyYield?: number;   // Total energy yield (kWh)
	
	// Grid AC Voltages
	gridVoltageUAB?: number;     // Line voltage UAB (V)
	gridVoltageUBC?: number;     // Line voltage UBC (V)
	gridVoltageUCA?: number;     // Line voltage UCA (V)
	phaseAVoltage?: number;      // Phase A voltage (V)
	phaseBVoltage?: number;      // Phase B voltage (V)
	phaseCVoltage?: number;      // Phase C voltage (V)
	
	// Grid AC Currents
	phaseACurrent?: number;      // Phase A current (A)
	phaseBCurrent?: number;      // Phase B current (A)
	phaseCCurrent?: number;      // Phase C current (A)
	gridFrequency?: number;      // Grid frequency (Hz)
	
	// PV String Data (up to 24 strings)
	pvStrings?: Array<{
		voltage: number;         // String voltage (V)
		current: number;         // String current (A)
		power?: number;          // Calculated power (W)
	}>;
	
	// Status & Temperature
	deviceStatus?: number;       // Device status code
	deviceStatusText?: string;   // Human readable status
	runningStatus?: number;      // Running status bitfield
	internalTemperature?: number; // Internal temperature (°C)
	insulationResistance?: number; // Insulation resistance (MΩ)
	
	// Alarms & Faults
	alarm1?: number;             // Alarm register 1
	alarm2?: number;             // Alarm register 2  
	alarm3?: number;             // Alarm register 3
	alarmTexts?: string[];       // Human readable alarms
	faultCode?: number;          // Current fault code
	
	// Legacy remapped data (for backward compatibility)
	dcCurrent?: number;          // DC current (A) - legacy
	status?: number;             // Status code - legacy
	cabinetTemperature?: number; // Cabinet temperature (°C) - legacy
	majorFault?: number;         // Major fault code - legacy
	minorFault?: number;         // Minor fault code - legacy
	warning?: number;            // Warning code - legacy
	
	error?: string;              // Error message if reading failed
}

/**
 * SUN2000 Inverter Functions Class
 * Supports both remapped register access and direct register access for comprehensive data
 */
export class SUN2000Functions {
	constructor(private client: HuaweiModbusClient) {}

	// ============================================================================
	// DEVICE IDENTIFICATION REGISTERS (Direct Access)
	// ============================================================================

	/**
	 * Read device model name
	 * Register: 30000 (String, 15 registers = 30 bytes)
	 */
	async readDeviceModel(deviceAddress: number): Promise<string | null> {
		const result = await this.client.readString(30000, 15, 30, deviceAddress);
		return result.success ? result.data! : null;
	}

	/**
	 * Read device serial number
	 * Register: 30015 (String, 10 registers = 20 bytes)
	 */
	async readSerialNumber(deviceAddress: number): Promise<string | null> {
		const result = await this.client.readString(30015, 10, 20, deviceAddress);
		return result.success ? result.data! : null;
	}

	/**
	 * Read firmware version
	 * Register: 31025 (String, 15 registers = 30 bytes)
	 */
	async readFirmwareVersion(deviceAddress: number): Promise<string | null> {
		const result = await this.client.readString(31025, 15, 30, deviceAddress);
		return result.success ? result.data! : null;
	}

	/**
	 * Read number of PV strings
	 * Register: 30071 (U16)
	 */
	async readNumberOfStrings(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readU16(30071, deviceAddress);
		return result.success ? result.data! : null;
	}

	/**
	 * Read rated power
	 * Register: 30073-30074 (U32, gain=1000)
	 */
	async readRatedPower(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readU32(30073, deviceAddress);
		return result.success ? result.data! / 1000.0 : null;
	}

	// ============================================================================
	// ENHANCED POWER & ENERGY DATA (Direct Access)
	// ============================================================================

	/**
	 * Read input power (direct register - more accurate than remapped)
	 * Register: 32064-32065 (I32, gain=1000)
	 */
	async readInputPowerDirect(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readI32(32064, deviceAddress);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read active power (direct register)
	 * Register: 32080-32081 (I32, gain=1000)
	 */
	async readActivePowerDirect(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readI32(32080, deviceAddress);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read reactive power (direct register)
	 * Register: 32082-32083 (I32, gain=1000)
	 */
	async readReactivePowerDirect(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readI32(32082, deviceAddress);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read power factor (direct register)
	 * Register: 32084 (I16, gain=1000)
	 */
	async readPowerFactorDirect(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readI16(32084, deviceAddress);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read peak power today
	 * Register: 32078-32079 (I32, gain=1000)
	 */
	async readPeakPowerToday(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readI32(32078, deviceAddress);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read daily energy yield
	 * Register: 32114-32115 (U32, gain=100)
	 */
	async readDailyEnergyYield(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readU32(32114, deviceAddress);
		return result.success ? result.data! / 100.0 : null;
	}

	/**
	 * Read total energy yield
	 * Register: 32106-32107 (U32, gain=100)
	 */
	async readTotalEnergyYield(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readU32(32106, deviceAddress);
		return result.success ? result.data! / 100.0 : null;
	}

	/**
	 * Read inverter efficiency
	 * Register: 32086 (U16, gain=100)
	 */
	async readEfficiency(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readU16(32086, deviceAddress);
		return result.success ? result.data! / 100.0 : null;
	}

	// ============================================================================
	// GRID VOLTAGE & CURRENT MEASUREMENTS (Direct Access)
	// ============================================================================

	/**
	 * Read grid line voltages (UAB, UBC, UCA)
	 * Registers: 32066-32068 (U16, gain=10)
	 */
	async readGridLineVoltages(deviceAddress: number): Promise<{UAB?: number, UBC?: number, UCA?: number}> {
		const result = await this.client.readHoldingRegisters(32066, 3, deviceAddress);
		
		if (!result.success || !result.data || result.data.length < 3) {
			return {};
		}

		return {
			UAB: result.data[0] / 10.0,
			UBC: result.data[1] / 10.0,
			UCA: result.data[2] / 10.0
		};
	}

	/**
	 * Read grid phase voltages (A, B, C)
	 * Registers: 32069-32071 (U16, gain=10)
	 */
	async readGridPhaseVoltages(deviceAddress: number): Promise<{A?: number, B?: number, C?: number}> {
		const result = await this.client.readHoldingRegisters(32069, 3, deviceAddress);
		
		if (!result.success || !result.data || result.data.length < 3) {
			return {};
		}

		return {
			A: result.data[0] / 10.0,
			B: result.data[1] / 10.0,
			C: result.data[2] / 10.0
		};
	}

	/**
	 * Read grid phase currents (A, B, C)
	 * Registers: 32072-32077 (I32, gain=1000)
	 */
	async readGridPhaseCurrents(deviceAddress: number): Promise<{A?: number, B?: number, C?: number}> {
		const result = await this.client.readHoldingRegisters(32072, 6, deviceAddress);
		
		if (!result.success || !result.data || result.data.length < 6) {
			return {};
		}

		return {
			A: combineI32RegistersLE(result.data[0], result.data[1]) / 1000.0,
			B: combineI32RegistersLE(result.data[2], result.data[3]) / 1000.0,
			C: combineI32RegistersLE(result.data[4], result.data[5]) / 1000.0
		};
	}

	/**
	 * Read grid frequency
	 * Register: 32085 (U16, gain=100)
	 */
	async readGridFrequency(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readU16(32085, deviceAddress);
		return result.success ? result.data! / 100.0 : null;
	}

	// ============================================================================
	// PV STRING DATA (Direct Access)
	// ============================================================================

	/**
	 * Read PV string data for specified number of strings
	 * String n: Voltage = 32014 + (2×n), Current = 32015 + (2×n)
	 * Voltage gain=10, Current gain=100
	 */
	async readPVStrings(deviceAddress: number, stringCount?: number, useIEC?: boolean): Promise<Array<any>> {
		// If string count not provided, try to read it first
		if (!stringCount) {
			const detectedStringCount = await this.readNumberOfStrings(deviceAddress);
			if (detectedStringCount !== null && detectedStringCount > 0) {
				stringCount = detectedStringCount;
			} else {
				stringCount = 4; // Default to 4 strings if can't determine
			}
		}

		// Limit to 24 strings maximum as per documentation
		stringCount = Math.min(stringCount, 24);

		const strings: Array<any> = [];

		// Read strings in batches to minimize requests
		const batchSize = 10; // Read 10 strings at a time (20 registers)
		
		for (let i = 0; i < stringCount; i += batchSize) {
			const remainingStrings = Math.min(batchSize, stringCount - i);
			const startRegister = 32016 + (i * 2); // PV1 starts at 32016
			const registerCount = remainingStrings * 2;

			const result = await this.client.readHoldingRegisters(startRegister, registerCount, deviceAddress);
			
			if (result.success && result.data) {
				for (let j = 0; j < remainingStrings; j++) {
					const voltageIndex = j * 2;
					const currentIndex = j * 2 + 1;
					
					if (voltageIndex < result.data.length && currentIndex < result.data.length) {
						const voltage = toSignedInt16(result.data[voltageIndex]) / 10.0;
						const current = toSignedInt16(result.data[currentIndex]) / 100.0;
						const power = voltage * current; // Calculate power in watts
						
						const stringData: any = {
							[useIEC ? 'n' : 'stringNumber']: i + j + 1,
							[useIEC ? 'U' : 'voltage']: voltage,
							[useIEC ? 'I' : 'current']: current,
							[useIEC ? 'P' : 'power']: power
						};
						
						strings.push(stringData);
					}
				}
			}
		}

		return strings;
	}

	// ============================================================================
	// STATUS & TEMPERATURE (Direct Access)
	// ============================================================================

	/**
	 * Read device status
	 * Register: 32089 (ENUM16)
	 */
	async readDeviceStatus(deviceAddress: number): Promise<{code?: number, text?: string}> {
		const result = await this.client.readU16(32089, deviceAddress);
		
		if (!result.success || result.data === undefined) {
			return {};
		}

		const code = result.data;
		let text = 'Unknown';

		switch (code) {
			case 0x0000: text = 'Standby: initializing'; break;
			case 0x0200: text = 'On-grid'; break;
			case 0x0201: text = 'Grid connection: power limited'; break;
			case 0x0300: text = 'Shutdown: fault'; break;
			case 0x0500: text = 'Spot-check ready'; break;
			default: text = `Unknown status (0x${code.toString(16).toUpperCase()})`;
		}

		return { code, text };
	}

	/**
	 * Read running status bitfield
	 * Register: 32002 (Bitfield16)
	 */
	async readRunningStatus(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readU16(32002, deviceAddress);
		return result.success ? result.data! : null;
	}

	/**
	 * Read internal temperature
	 * Register: 32087 (I16, gain=10)
	 */
	async readInternalTemperature(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readI16(32087, deviceAddress);
		return result.success ? result.data! / 10.0 : null;
	}

	/**
	 * Read insulation resistance (direct register)
	 * Register: 32088 (U16, gain=1000)
	 */
	async readInsulationResistanceDirect(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readU16(32088, deviceAddress);
		return result.success ? result.data! / 1000.0 : null;
	}

	// ============================================================================
	// ALARM SYSTEM (Direct Access)
	// ============================================================================

	/**
	 * Read all alarm registers and decode them
	 * Registers: 32008 (Alarm1), 32009 (Alarm2), 32010 (Alarm3)
	 */
	async readAlarms(deviceAddress: number): Promise<{alarm1?: number, alarm2?: number, alarm3?: number, alarmTexts?: string[]}> {
		const result = await this.client.readHoldingRegisters(32008, 3, deviceAddress);
		
		if (!result.success || !result.data || result.data.length < 3) {
			return {};
		}

		const alarm1 = result.data[0];
		const alarm2 = result.data[1];
		const alarm3 = result.data[2];
		const alarmTexts: string[] = [];

		// Decode Alarm 1 bits
		if (alarm1 & (1 << 0)) alarmTexts.push('High String Input Voltage (Major)');
		if (alarm1 & (1 << 1)) alarmTexts.push('DC Arc Fault (Major)');
		if (alarm1 & (1 << 2)) alarmTexts.push('String Reverse Connection (Major)');
		if (alarm1 & (1 << 3)) alarmTexts.push('String Current Backfeed (Warning)');
		if (alarm1 & (1 << 4)) alarmTexts.push('Abnormal String Power (Warning)');
		if (alarm1 & (1 << 5)) alarmTexts.push('AFCI Self-Check Fail (Major)');
		if (alarm1 & (1 << 6)) alarmTexts.push('Phase Wire Short-Circuited to PE (Major)');
		if (alarm1 & (1 << 7)) alarmTexts.push('Grid Loss (Major)');
		if (alarm1 & (1 << 8)) alarmTexts.push('Grid Undervoltage (Major)');
		if (alarm1 & (1 << 9)) alarmTexts.push('Grid Overvoltage (Major)');
		if (alarm1 & (1 << 10)) alarmTexts.push('Grid Voltage Imbalance (Major)');
		if (alarm1 & (1 << 11)) alarmTexts.push('Grid Overfrequency (Major)');
		if (alarm1 & (1 << 12)) alarmTexts.push('Grid Underfrequency (Major)');
		if (alarm1 & (1 << 13)) alarmTexts.push('Unstable Grid Frequency (Major)');
		if (alarm1 & (1 << 14)) alarmTexts.push('Output Overcurrent (Major)');
		if (alarm1 & (1 << 15)) alarmTexts.push('Output DC Component Overhigh (Major)');

		// Decode Alarm 2 bits
		if (alarm2 & (1 << 0)) alarmTexts.push('Abnormal Residual Current (Major)');
		if (alarm2 & (1 << 1)) alarmTexts.push('Abnormal Grounding (Major)');
		if (alarm2 & (1 << 2)) alarmTexts.push('Low Insulation Resistance (Major)');
		if (alarm2 & (1 << 3)) alarmTexts.push('Overtemperature (Minor)');
		if (alarm2 & (1 << 4)) alarmTexts.push('Device Fault (Major)');
		if (alarm2 & (1 << 5)) alarmTexts.push('Upgrade Failed or Version Mismatch (Minor)');
		if (alarm2 & (1 << 6)) alarmTexts.push('License Expired (Warning)');
		if (alarm2 & (1 << 7)) alarmTexts.push('Faulty Monitoring Unit (Minor)');
		if (alarm2 & (1 << 8)) alarmTexts.push('Faulty Power Collector (Major)');
		if (alarm2 & (1 << 9)) alarmTexts.push('Battery Abnormal (Minor)');
		if (alarm2 & (1 << 10)) alarmTexts.push('Active Islanding (Major)');
		if (alarm2 & (1 << 11)) alarmTexts.push('Passive Islanding (Major)');
		if (alarm2 & (1 << 12)) alarmTexts.push('Transient AC Overvoltage (Major)');
		if (alarm2 & (1 << 13)) alarmTexts.push('Peripheral Port Short Circuit (Warning)');
		if (alarm2 & (1 << 14)) alarmTexts.push('Churn Output Overload (Major)');
		if (alarm2 & (1 << 15)) alarmTexts.push('Abnormal PV Module Configuration (Major)');

		// Decode Alarm 3 bits
		if (alarm3 & (1 << 0)) alarmTexts.push('Optimizer Fault (Warning)');
		if (alarm3 & (1 << 1)) alarmTexts.push('Built-in PID Operation Abnormal (Minor)');
		if (alarm3 & (1 << 2)) alarmTexts.push('High Input String Voltage to Ground (Major)');
		if (alarm3 & (1 << 3)) alarmTexts.push('External Fan Abnormal (Major)');
		if (alarm3 & (1 << 4)) alarmTexts.push('Battery Reverse Connection (Major)');
		if (alarm3 & (1 << 5)) alarmTexts.push('On-grid/Off-grid Controller Abnormal (Major)');
		if (alarm3 & (1 << 6)) alarmTexts.push('PV String Loss (Warning)');
		if (alarm3 & (1 << 7)) alarmTexts.push('Internal Fan Abnormal (Major)');
		if (alarm3 & (1 << 8)) alarmTexts.push('DC Protection Unit Abnormal (Major)');
		if (alarm3 & (1 << 9)) alarmTexts.push('EL Unit Abnormal (Minor)');
		if (alarm3 & (1 << 10)) alarmTexts.push('Active Adjustment Instruction Abnormal (Major)');
		if (alarm3 & (1 << 11)) alarmTexts.push('Reactive Adjustment Instruction Abnormal (Major)');
		if (alarm3 & (1 << 12)) alarmTexts.push('CT Wiring Abnormal (Major)');
		if (alarm3 & (1 << 13)) alarmTexts.push('DC Arc Fault (ADMC - Manual Clear Required) (Major)');
		if (alarm3 & (1 << 14)) alarmTexts.push('DC Switch Abnormal (Minor)');
		if (alarm3 & (1 << 15)) alarmTexts.push('Low Battery Discharge Capacity (Warning)');

		return { alarm1, alarm2, alarm3, alarmTexts };
	}

	/**
	 * Read fault code
	 * Register: 32090 (U16)
	 */
	async readFaultCode(deviceAddress: number): Promise<number | null> {
		const result = await this.client.readU16(32090, deviceAddress);
		return result.success ? result.data! : null;
	}

	// ============================================================================
	// LEGACY REMAPPED REGISTER ACCESS (for backward compatibility)
	// ============================================================================

	/**
	 * Calculate remapped register address
	 * Formula: 51000 + (25 × (Device Address - 1)) + Offset
	 */
	private getRemappedRegister(deviceAddress: number, offset: number): number {
		return 51000 + (25 * (deviceAddress - 1)) + offset;
	}

	/**
	 * Read comprehensive inverter data using direct register access
	 * Combines basic remapped data with enhanced direct register data
	 */
	async readInverterData(deviceAddress: number, deviceName?: string, dataCategories?: string[], alwaysIncludeAlarmTexts?: boolean, useIEC?: boolean): Promise<any> {
		const result: any = {
			unitId: deviceAddress,
			...(deviceName && { deviceName })
		};

		try {
			// Always read basic power data via remapped registers (for backward compatibility)
			await this.readRemappedData(result, deviceAddress, useIEC);

			// Read enhanced data based on categories (default to all if not specified)
			const categories = dataCategories || ['device', 'power', 'voltages', 'currents', 'strings', 'status', 'alarms'];

			// Device identification
			if (categories.includes('device')) {
				const [model, serialNumber, firmwareVersion, numberOfStrings, ratedPower] = await Promise.all([
					this.readDeviceModel(deviceAddress),
					this.readSerialNumber(deviceAddress),
					this.readFirmwareVersion(deviceAddress),
					this.readNumberOfStrings(deviceAddress),
					this.readRatedPower(deviceAddress)
				]);

				if (model) result.model = model;
				if (serialNumber) result.serialNumber = serialNumber;
				if (firmwareVersion) result.firmwareVersion = firmwareVersion;
				if (numberOfStrings !== null) result.numberOfStrings = numberOfStrings;
				if (ratedPower !== null) result.ratedPower = ratedPower;
			}

			// Enhanced power and energy data
			if (categories.includes('power')) {
				const [peakPowerToday, dailyEnergyYield, totalEnergyYield, efficiency] = await Promise.all([
					this.readPeakPowerToday(deviceAddress),
					this.readDailyEnergyYield(deviceAddress),
					this.readTotalEnergyYield(deviceAddress),
					this.readEfficiency(deviceAddress)
				]);

				if (peakPowerToday !== null) result[useIEC ? 'Pmax' : 'peakPowerToday'] = peakPowerToday;
				if (dailyEnergyYield !== null) result[useIEC ? 'EPId' : 'dailyEnergyYield'] = dailyEnergyYield;
				if (totalEnergyYield !== null) result[useIEC ? 'EPI' : 'totalEnergyYield'] = totalEnergyYield;
				if (efficiency !== null) result[useIEC ? 'eff' : 'efficiency'] = efficiency;
			}

			// Grid voltages
			if (categories.includes('voltages')) {
				const [lineVoltages, phaseVoltages] = await Promise.all([
					this.readGridLineVoltages(deviceAddress),
					this.readGridPhaseVoltages(deviceAddress)
				]);

				if (lineVoltages.UAB !== undefined) result[useIEC ? 'Uab' : 'gridVoltageUAB'] = lineVoltages.UAB;
				if (lineVoltages.UBC !== undefined) result[useIEC ? 'Ubc' : 'gridVoltageUBC'] = lineVoltages.UBC;
				if (lineVoltages.UCA !== undefined) result[useIEC ? 'Uca' : 'gridVoltageUCA'] = lineVoltages.UCA;
				if (phaseVoltages.A !== undefined) result[useIEC ? 'Ua' : 'phaseAVoltage'] = phaseVoltages.A;
				if (phaseVoltages.B !== undefined) result[useIEC ? 'Ub' : 'phaseBVoltage'] = phaseVoltages.B;
				if (phaseVoltages.C !== undefined) result[useIEC ? 'Uc' : 'phaseCVoltage'] = phaseVoltages.C;
			}

			// Grid currents and frequency
			if (categories.includes('currents')) {
				const [phaseCurrents, gridFrequency] = await Promise.all([
					this.readGridPhaseCurrents(deviceAddress),
					this.readGridFrequency(deviceAddress)
				]);

				if (phaseCurrents.A !== undefined) result[useIEC ? 'Ia' : 'phaseACurrent'] = phaseCurrents.A;
				if (phaseCurrents.B !== undefined) result[useIEC ? 'Ib' : 'phaseBCurrent'] = phaseCurrents.B;
				if (phaseCurrents.C !== undefined) result[useIEC ? 'Ic' : 'phaseCCurrent'] = phaseCurrents.C;
				if (gridFrequency !== null) result[useIEC ? 'Fr' : 'gridFrequency'] = gridFrequency;
			}

			// PV string data
			if (categories.includes('strings')) {
				const pvStrings = await this.readPVStrings(deviceAddress, result.numberOfStrings, useIEC);
				if (pvStrings.length > 0) {
					result[useIEC ? 'pv' : 'pvStrings'] = pvStrings;
				}
			}

			// Status and temperature
			if (categories.includes('status')) {
				const [deviceStatus, runningStatus, internalTemp, insulationResistance] = await Promise.all([
					this.readDeviceStatus(deviceAddress),
					this.readRunningStatus(deviceAddress),
					this.readInternalTemperature(deviceAddress),
					this.readInsulationResistanceDirect(deviceAddress)
				]);

				if (deviceStatus.code !== undefined) result.deviceStatus = deviceStatus.code;
				if (deviceStatus.text) result.deviceStatusText = deviceStatus.text;
				if (runningStatus !== null) result.runningStatus = runningStatus;
				if (internalTemp !== null) result[useIEC ? 'TempInt' : 'internalTemperature'] = internalTemp;
				if (insulationResistance !== null) result.insulationResistance = insulationResistance;
			}

			// Alarms and faults
			if (categories.includes('alarms')) {
				const [alarms, faultCode] = await Promise.all([
					this.readAlarms(deviceAddress),
					this.readFaultCode(deviceAddress)
				]);

				if (alarms.alarm1 !== undefined) result.alarm1 = alarms.alarm1;
				if (alarms.alarm2 !== undefined) result.alarm2 = alarms.alarm2;
				if (alarms.alarm3 !== undefined) result.alarm3 = alarms.alarm3;
				if (alwaysIncludeAlarmTexts || (alarms.alarmTexts && alarms.alarmTexts.length > 0)) {
					result.alarmTexts = alarms.alarmTexts || [];
				}
				if (faultCode !== null) result.faultCode = faultCode;
			}

		} catch (error) {
			result.error = error instanceof Error ? error.message : 'Unknown error reading inverter data';
		}

		return result;
	}

	/**
	 * Read basic remapped register data (for backward compatibility)
	 */
	private async readRemappedData(result: any, deviceAddress: number, useIEC?: boolean): Promise<void> {
		try {
			// Read power data (offsets 0-8)
			const baseRegister = this.getRemappedRegister(deviceAddress, 0);
			
			// Try to read multiple registers at once for efficiency
			// Registers 0-8: Active Power (I32), Reactive Power (I32), DC Current (I16), Input Power (U32), Insulation (U16), Power Factor (I16)
			const powerResult = await this.client.readHoldingRegisters(baseRegister, 9, 0);
			
			if (powerResult.success && powerResult.data && powerResult.data.length >= 9) {
				const registers = powerResult.data;
				
				// Active Power: Offset 0-1 (I32, gain=1000)
				const activePowerRaw = combineI32RegistersLE(registers[0], registers[1]);
				result[useIEC ? 'P' : 'activePower'] = activePowerRaw / 1000.0;
				
				// Reactive Power: Offset 2-3 (I32, gain=1000)
				const reactivePowerRaw = combineI32RegistersLE(registers[2], registers[3]);
				result[useIEC ? 'Q' : 'reactivePower'] = reactivePowerRaw / 1000.0;
				
				// DC Current: Offset 4 (I16, gain=100)
				result[useIEC ? 'dcI' : 'dcCurrent'] = toSignedInt16(registers[4]) / 100.0;
				
				// Input Power: Offset 5-6 (U32, gain=1000)
				const inputPowerRaw = combineU32RegistersLE(registers[5], registers[6]);
				result[useIEC ? 'dcP' : 'inputPower'] = inputPowerRaw / 1000.0;
				
				// Power Factor: Offset 8 (I16, gain=1000)
				result[useIEC ? 'PF' : 'powerFactor'] = toSignedInt16(registers[8]) / 1000.0;
			}

			// Read status and temperature (offsets 9, 11)
			const statusRegister = this.getRemappedRegister(deviceAddress, 9);
			const statusResult = await this.client.readU16(statusRegister, 0);
			if (statusResult.success) {
				result.status = statusResult.data!;
			}

			const tempRegister = this.getRemappedRegister(deviceAddress, 11);
			const tempResult = await this.client.readI16(tempRegister, 0);
			if (tempResult.success) {
				result[useIEC ? 'TempCab' : 'cabinetTemperature'] = tempResult.data! / 10.0;
			}

			// Read fault data (offsets 12-17)
			const faultRegister = this.getRemappedRegister(deviceAddress, 12);
			const faultResult = await this.client.readHoldingRegisters(faultRegister, 6, 0);
			
			if (faultResult.success && faultResult.data && faultResult.data.length >= 6) {
				const faultRegisters = faultResult.data;
				
				// Major Fault: Offset 12-13 (U32)
				result.majorFault = combineU32RegistersLE(faultRegisters[0], faultRegisters[1]);
				
				// Minor Fault: Offset 14-15 (U32)
				result.minorFault = combineU32RegistersLE(faultRegisters[2], faultRegisters[3]);
				
				// Warning: Offset 16-17 (U32)
				result.warning = combineU32RegistersLE(faultRegisters[4], faultRegisters[5]);
			}

		} catch (error) {
			// Don't throw here, just let the main method handle errors
		}
	}

	/**
	 * Read data from multiple inverters
	 * Processes them sequentially to avoid overwhelming the device
	 */
	async readMultipleInverters(
		devices: Array<{unitId: number, deviceAddress: number, deviceName?: string}>,
		dataCategories?: string[],
		alwaysIncludeAlarmTexts?: boolean,
		useIEC?: boolean
	): Promise<any[]> {
		const results: any[] = [];

		// Process inverters one by one to be safe
		for (const device of devices) {
			try {
				const inverterData = await this.readInverterData(device.deviceAddress, device.deviceName, dataCategories, alwaysIncludeAlarmTexts, useIEC);
				results.push(inverterData);
				
				// Small delay between inverters to be gentle on the network
				await new Promise(resolve => setTimeout(resolve, 100));
			} catch (error) {
				// Add error entry for failed inverter
				results.push({
					unitId: device.unitId,
					deviceName: device.deviceName,
					error: error instanceof Error ? error.message : 'Failed to read inverter'
				});
			}
		}

		return results;
	}
}