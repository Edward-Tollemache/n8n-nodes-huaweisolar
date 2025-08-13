# Huawei Solar N8N Nodes - API Output Reference

This document provides a comprehensive guide to the JSON output structures and data formats returned by the Huawei SmartLogger and SUN2000 inverter N8N nodes.

## Table of Contents
1. [Field Naming Conventions](#field-naming-conventions)
2. [SmartLogger Node Output](#smartlogger-node-output)
3. [SUN2000 Inverter Node Output](#sun2000-inverter-node-output)
4. [Alarm System Reference](#alarm-system-reference)
5. [Data Types and Units](#data-types-and-units)
6. [Practical Examples](#practical-examples)

---

## Field Naming Conventions

Both SmartLogger and SUN2000 nodes support two field naming conventions that can be selected via the **Field Naming Convention** parameter:

### Descriptive Naming (Default)
Uses human-readable field names for easier understanding and debugging:
```json
{
  "activePower": 79.725,
  "reactivePower": 1.234,
  "phaseAVoltage": 230.5,
  "phaseACurrent": 115.3,
  "dailyEnergyYield": 250.0,
  "efficiency": 97.89
}
```

### IEC 61850 Standard Naming
Uses standardized electrical engineering field names for professional integration:
```json
{
  "P": 79.725,
  "Q": 1.234,
  "Ua": 230.5,
  "Ia": 115.3,
  "EPId": 250.0,
  "eff": 97.89
}
```

### Field Mapping Reference

| Descriptive Name | IEC 61850 | Description | Unit |
|------------------|-----------|-------------|------|
| `activePower` | `P` | Active power | kW |
| `reactivePower` | `Q` | Reactive power | kVAR |
| `inputPower` | `dcP` | DC input power | kW |
| `powerFactor` | `PF` | Power factor | - |
| `efficiency` | `eff` | Inverter efficiency | % |
| `dailyEnergyYield` | `EPId` | Daily energy yield | kWh |
| `totalEnergyYield` | `EPI` | Total energy yield | kWh |
| `gridVoltageUAB` | `Uab` | Line voltage A-B | V |
| `gridVoltageUBC` | `Ubc` | Line voltage B-C | V |
| `gridVoltageUCA` | `Uca` | Line voltage C-A | V |
| `phaseAVoltage` | `Ua` | Phase A voltage | V |
| `phaseBVoltage` | `Ub` | Phase B voltage | V |
| `phaseCVoltage` | `Uc` | Phase C voltage | V |
| `phaseACurrent` | `Ia` | Phase A current | A |
| `phaseBCurrent` | `Ib` | Phase B current | A |
| `phaseCCurrent` | `Ic` | Phase C current | A |
| `gridFrequency` | `Fr` | Grid frequency | Hz |
| `internalTemperature` | `TempInt` | Internal temperature | °C |
| `cabinetTemperature` | `TempCab` | Cabinet temperature | °C |
| `pvTemperature` | `TempPV` | PV module temperature | °C |
| `ambientTemperature` | `TempAmb` | Ambient temperature | °C |
| `dcCurrent` | `dcI` | DC current | A |
| `dcVoltage` | `dcU` | DC voltage | V |

### PV String Fields
| Descriptive Name | IEC 61850 | Description | Unit |
|------------------|-----------|-------------|------|
| `stringNumber` | `n` | String identifier | - |
| `voltage` | `U` | String voltage | V |
| `current` | `I` | String current | A |
| `power` | `P` | String power | W |

---

## SmartLogger Node Output

The SmartLogger node provides two main operations for interacting with Huawei SmartLogger 3000 devices.

### Operation: Read Data

**Purpose:** Read selected data categories from the SmartLogger device.

**Output Structure:**
```json
{
  "system": { /* System data if selected */ },
  "power": { /* Power data if selected */ },
  "environmental": { /* Environmental data if selected */ },
  "alarms": { /* Alarm data if selected */ },
  "_metadata": {
    "operation": "readData",
    "host": "192.168.1.10",
    "port": 502,
    "unitId": 3,
    "timestamp": "2025-07-29T08:30:25.791Z",
    "success": true
  }
}
```

#### System Data Fields
| Field | Type | Description | Unit |
|-------|------|-------------|------|
| `dateTime` | number | System timestamp | epoch seconds |
| `dstEnabled` | boolean | Daylight saving time enabled | - |

#### Power Data Fields
| Field | Type | Description | Unit |
|-------|------|-------------|------|
| `dcCurrent` | number | Total DC current | A |
| `inputPower` | number | Total input power | kW |
| `activePower` | number | Total active power | kW |
| `reactivePower` | number | Total reactive power | kVar |
| `powerFactor` | number | System power factor | - |
| `totalEnergy` | number | Total energy yield | kWh |
| `dailyEnergy` | number | Daily energy yield | kWh |
| `co2Reduction` | number | CO2 reduction | kg |

#### Environmental Data Fields
| Field | Type | Description | Unit |
|-------|------|-------------|------|
| `windSpeed` | number | Wind speed | m/s |
| `windDirection` | number | Wind direction | degrees |
| `pvTemperature` | number | PV module temperature | °C |
| `ambientTemperature` | number | Ambient temperature | °C |
| `irradiance` | number | Solar irradiance | W/m² |
| `dailyIrradiation` | number | Daily irradiation | MJ/m² |

### Operation: Discover Devices

**Purpose:** Discover all connected devices (inverters, meters, etc.) on the Modbus network.

**Output Structure:**
```json
{
  "allDevices": [
    {
      "unitId": 12,
      "deviceName": "SUN2000-100KTL-M2",
      "deviceAddress": 12,
      "connectionStatus": "Online",
      "portNumber": 1
    }
  ],
  "_metadata": {
    "operation": "discoverDevices", 
    "host": "192.168.1.10",
    "port": 502,
    "unitId": 3,
    "timestamp": "2025-07-29T08:30:25.791Z",
    "success": true
  }
}
```

---

## SUN2000 Inverter Node Output

The SUN2000 node provides detailed inverter data with comprehensive monitoring capabilities. **Starting from version 0.0.014**, the node outputs single items per inverter with nested telemetry and status objects for optimal MQTT integration.

### Current Output Structure (v0.0.014+)

Each inverter produces **1 item** with nested structure:

```json
{
  "ts": "2025-08-13T09:04:01.260Z",
  "unitId": 12,
  "deviceName": "A", 
  "serialNumber": "ES2450055458",
  "model": "SUN2000-100KTL-M2",

  "telemetry": {
    "P": 73.607,
    "Q": 10.46,
    "PF": 0.99,
    "dcP": 74.972,
    "dcI": 100.38,
    "eff": 98.19,
    "Pmax": 73.739,
    "EPId": 175.55,
    "EPI": 105481.55,
    "Uab": 407,
    "Ubc": 407,
    "Uca": 404.2,
    "Ua": 234.6,
    "Ub": 235,
    "Uc": 235.7,
    "Ia": 105.731,
    "Ib": 105.934,
    "Ic": 105.957,
    "Fr": 50,
    "TempInt": 48.4,
    "TempCab": 48.4,
    "numberOfStrings": 20,
    "ratedPower": 100,
    "insulationResistance": 0.887,
    "pv": [
      {"n": 1, "U": 756.6, "I": 8.22, "P": 6219.252},
      {"n": 2, "U": 754.8, "I": 8.19, "P": 6181.812}
    ]
  },

  "status": {
    "status": 512,
    "deviceStatus": 512,
    "deviceStatusText": "On-grid",
    "runningStatus": 7,
    "majorFault": 0,
    "minorFault": 0,
    "warning": 0,
    "alarm1": 0,
    "alarm2": 0,
    "alarm3": 0,
    "faultCode": 0
  }
}
```

### MQTT Integration Benefits

The nested structure enables clean MQTT topic mapping:

```javascript
// Extract specific measurements
const activePower = item.telemetry.P;
const voltage = item.telemetry.Ua;
const alarmStatus = item.status.alarm1;

// MQTT topic structure
`solar/${item.deviceName}/telemetry` → item.telemetry
`solar/${item.deviceName}/status` → item.status
```

### Multiple Inverter Example

**Input**: 2 working inverters + 1 failed inverter  
**Output**: 3 items total

- Item 1: Inverter A (nested telemetry + status)
- Item 2: Inverter B (nested telemetry + status)
- Item 3: Inverter C (error information)

```json
// Item 3 (Error case)
{
  "ts": "2025-08-13T09:04:01.260Z",
  "unitId": 14,
  "deviceName": "C",
  "error": "Connection timeout after 5000ms"
}
```

### Data Categories

Users can select which data categories to include:

#### Device Information (`device`)
| Field | Type | Description | Unit |
|-------|------|-------------|------|
| `model` | string | Device model name | - |
| `serialNumber` | string | Device serial number | - |
| `firmwareVersion` | string | Firmware version | - |
| `numberOfStrings` | number | Number of PV strings | - |
| `ratedPower` | number | Rated power | kW |

#### Power & Energy (`power`)
| Field | Type | Description | Unit |
|-------|------|-------------|------|
| `activePower` | number | Active power output | kW |
| `reactivePower` | number | Reactive power | kVar |
| `inputPower` | number | DC input power | kW |
| `powerFactor` | number | Power factor | - |
| `efficiency` | number | Inverter efficiency | % |
| `peakPowerToday` | number | Peak power today | kW |
| `dailyEnergyYield` | number | Daily energy yield | kWh |
| `totalEnergyYield` | number | Total energy yield | kWh |

#### Grid Voltages (`voltages`)
| Field | Type | Description | Unit |
|-------|------|-------------|------|
| `gridVoltageUAB` | number | Line voltage UAB | V |
| `gridVoltageUBC` | number | Line voltage UBC | V |
| `gridVoltageUCA` | number | Line voltage UCA | V |
| `phaseAVoltage` | number | Phase A voltage | V |
| `phaseBVoltage` | number | Phase B voltage | V |
| `phaseCVoltage` | number | Phase C voltage | V |

#### Grid Currents (`currents`)
| Field | Type | Description | Unit |
|-------|------|-------------|------|
| `phaseACurrent` | number | Phase A current | A |
| `phaseBCurrent` | number | Phase B current | A |
| `phaseCCurrent` | number | Phase C current | A |
| `gridFrequency` | number | Grid frequency | Hz |

#### PV String Data (`strings`)
| Field | Type | Description | Unit |
|-------|------|-------------|------|
| `pvStrings` | array | Array of PV string objects | - |

**PV String Object Structure (Descriptive):**
```json
{
  "stringNumber": 1,   // String identifier
  "voltage": 775.9,    // String voltage (V)
  "current": 7.63,     // String current (A) 
  "power": 5920.117    // Calculated power (W)
}
```

**PV String Object Structure (IEC 61850):**
```json
{
  "n": 1,              // String identifier
  "U": 775.9,          // String voltage (V)
  "I": 7.63,           // String current (A) 
  "P": 5920.117        // Calculated power (W)
}
```

**Example PV Strings Output (Descriptive):**
```json
"pvStrings": [
  {
    "stringNumber": 1,
    "voltage": 775.9,
    "current": 7.63,
    "power": 5920.117
  },
  {
    "stringNumber": 2,
    "voltage": 775.9,
    "current": 7.5,
    "power": 5819.25
  }
]
```

**Example PV Strings Output (IEC 61850):**
```json
"pv": [
  {
    "n": 1,
    "U": 775.9,
    "I": 7.63,
    "P": 5920.117
  },
  {
    "n": 2,
    "U": 775.9,
    "I": 7.5,
    "P": 5819.25
  }
]
```

#### Status & Temperature (`status`)
| Field | Type | Description | Unit |
|-------|------|-------------|------|
| `deviceStatus` | number | Device status code | - |
| `deviceStatusText` | string | Human-readable status | - |
| `runningStatus` | number | Running status bitfield | - |
| `internalTemperature` | number | Internal temperature | °C |
| `insulationResistance` | number | Insulation resistance | MΩ |

**Device Status Codes:**
- `0x0000` (0): Standby: initializing
- `0x0200` (512): On-grid
- `0x0201` (513): Grid connection: power limited
- `0x0300` (768): Shutdown: fault
- `0x0500` (1280): Spot-check ready

#### Alarms & Faults (`alarms`)
| Field | Type | Description | Unit |
|-------|------|-------------|------|
| `alarm1` | number | Alarm register 1 bitfield | - |
| `alarm2` | number | Alarm register 2 bitfield | - |
| `alarm3` | number | Alarm register 3 bitfield | - |
| `alarmTexts` | array | Human-readable alarm descriptions | - |
| `faultCode` | number | Current fault code | - |

---

## Alarm System Reference

The alarm system uses three 16-bit registers where each bit represents a specific alarm condition.

### How Alarm Bitfields Work

Each alarm register can contain multiple simultaneous alarms using bitwise OR operations:

**Example: Multiple Alarms in alarm1**
- Bit 1 (DC Arc Fault) = 2
- Bit 8 (Grid Undervoltage) = 256
- Bit 14 (Output Overcurrent) = 16384
- **Result: alarm1 = 16642** (2 + 256 + 16384)

### Alarm Output Behavior

The "Always Include Alarm Texts" toggle controls output consistency:

**Toggle OFF (default):**
```json
{
  "alarm1": 0,
  "alarm2": 0,
  "alarm3": 0,
  "faultCode": 0
  // No "alarmTexts" field when no alarms
}
```

**Toggle ON (consistent structure):**
```json
{
  "alarm1": 0,
  "alarm2": 0,
  "alarm3": 0,
  "alarmTexts": [],  // Always present, empty array when no alarms
  "faultCode": 0
}
```

### Complete Alarm Reference

#### Alarm Register 1 (Basic Alarms)
| Bit | Value | Alarm Description | Severity |
|-----|-------|-------------------|----------|
| 0 | 1 | High String Input Voltage (2001) | Major |
| 1 | 2 | DC Arc Fault (2002) | Major |
| 2 | 4 | String Reverse Connection (2011) | Major |
| 3 | 8 | String Current Backfeed (2012) | Warning |
| 4 | 16 | Abnormal String Power (2013) | Warning |
| 5 | 32 | AFCI Self-Check Fail (2021) | Major |
| 6 | 64 | Phase Wire Short-Circuited to PE (2031) | Major |
| 7 | 128 | Grid Loss (2032) | Major |
| 8 | 256 | Grid Undervoltage (2033) | Major |
| 9 | 512 | Grid Overvoltage (2034) | Major |
| 10 | 1024 | Grid Voltage Imbalance (2035) | Major |
| 11 | 2048 | Grid Overfrequency (2036) | Major |
| 12 | 4096 | Grid Underfrequency (2037) | Major |
| 13 | 8192 | Unstable Grid Frequency (2038) | Major |
| 14 | 16384 | Output Overcurrent (2039) | Major |
| 15 | 32768 | Output DC Component Overhigh (2040) | Major |

#### Alarm Register 2 (System Alarms)
| Bit | Value | Alarm Description | Severity |
|-----|-------|-------------------|----------|
| 0 | 1 | Abnormal Residual Current (2051) | Major |
| 1 | 2 | Abnormal Grounding (2061) | Major |
| 2 | 4 | Low Insulation Resistance (2062) | Major |
| 3 | 8 | Overtemperature (2063) | Minor |
| 4 | 16 | Device Fault (2064) | Major |
| 5 | 32 | Upgrade Failed or Version Mismatch (2065) | Minor |
| 6 | 64 | License Expired (2066) | Warning |
| 7 | 128 | Faulty Monitoring Unit (61440) | Minor |
| 8 | 256 | Faulty Power Collector (2067) | Major |
| 9 | 512 | Battery Abnormal (2068) | Minor |
| 10 | 1024 | Active Islanding (2070) | Major |
| 11 | 2048 | Passive Islanding (2071) | Major |
| 12 | 4096 | Transient AC Overvoltage (2072) | Major |
| 13 | 8192 | Peripheral Port Short Circuit (2075) | Warning |
| 14 | 16384 | Churn Output Overload (2077) | Major |
| 15 | 32768 | Abnormal PV Module Configuration (2080) | Major |

#### Alarm Register 3 (Extended Alarms)
| Bit | Value | Alarm Description | Severity |
|-----|-------|-------------------|----------|
| 0 | 1 | Optimizer Fault (2081) | Warning |
| 1 | 2 | Built-in PID Operation Abnormal (2085) | Minor |
| 2 | 4 | High Input String Voltage to Ground (2014) | Major |
| 3 | 8 | External Fan Abnormal (2086) | Major |
| 4 | 16 | Battery Reverse Connection (2069) | Major |
| 5 | 32 | On-grid/Off-grid Controller Abnormal (2082) | Major |
| 6 | 64 | PV String Loss (2015) | Warning |
| 7 | 128 | Internal Fan Abnormal (2087) | Major |
| 8 | 256 | DC Protection Unit Abnormal (2088) | Major |
| 9 | 512 | EL Unit Abnormal (2089) | Minor |
| 10 | 1024 | Active Adjustment Instruction Abnormal (2090) | Major |
| 11 | 2048 | Reactive Adjustment Instruction Abnormal (2091) | Major |
| 12 | 4096 | CT Wiring Abnormal (2092) | Major |
| 13 | 8192 | DC Arc Fault (ADMC - Manual Clear Required) (2003) | Major |
| 14 | 16384 | DC Switch Abnormal (2093) | Minor |
| 15 | 32768 | Low Battery Discharge Capacity (2094) | Warning |

---

## Data Types and Units

### Numeric Precision
- **Power values**: 3 decimal places (kW)
- **Current values**: 2-3 decimal places (A)
- **Voltage values**: 1 decimal place (V)
- **Temperature values**: 1 decimal place (°C)
- **Percentage values**: 2 decimal places (%)

### Value Ranges
- **Power Factor**: -1.0 to 1.0
- **Efficiency**: 0-100%
- **Temperature**: -40°C to 85°C
- **Voltage**: 0-1000V (typical)
- **Current**: 0-200A (typical)
- **Frequency**: 45-65Hz (typical)

### Special Values
- **0**: Normal zero value or no measurement
- **null/undefined**: Data not available or read error
- **Empty array []**: No items (e.g., no alarms, no strings)

---

## Practical Examples

### Example 1: Healthy Inverter (No Alarms)

```json
{
  "inverters": [
    {
      "unitId": 12,
      "deviceName": "Inverter-12",
      "activePower": 70.436,
      "reactivePower": 11.866,
      "inputPower": 71.698,
      "powerFactor": 0.986,
      "efficiency": 98.24,
      "gridVoltageUAB": 409,
      "phaseAVoltage": 233.4,
      "phaseACurrent": 101.168,
      "gridFrequency": 50,
      "deviceStatus": 512,
      "deviceStatusText": "On-grid",
      "internalTemperature": 44.4,
      "insulationResistance": 0.613,
      "alarm1": 0,
      "alarm2": 0,
      "alarm3": 0,
      "alarmTexts": [],
      "faultCode": 0
    }
  ],
  "_metadata": {
    "operation": "specifyDevices",
    "inverterCount": 1,
    "timestamp": "2025-07-29T08:40:24.475Z",
    "success": true
  }
}
```

### Example 2: Inverter with Multiple Alarms

```json
{
  "inverters": [
    {
      "unitId": 12,
      "deviceName": "Inverter-12",
      "activePower": 0,
      "deviceStatus": 768,
      "deviceStatusText": "Shutdown: fault",
      "alarm1": 16642,    // Contains 3 different alarms
      "alarm2": 20,       // Contains 2 different alarms
      "alarm3": 64,       // Contains 1 alarm
      "alarmTexts": [
        "DC Arc Fault (Major)",
        "Grid Undervoltage (Major)",
        "Output Overcurrent (Major)",
        "Low Insulation Resistance (Major)",
        "Device Fault (Major)",
        "PV String Loss (Warning)"
      ],
      "faultCode": 2064
    }
  ],
  "_metadata": {
    "operation": "readFromDiscovery",
    "inverterCount": 1,
    "timestamp": "2025-07-29T08:40:24.475Z",
    "success": true
  }
}
```

### Example 3: Partial PV String Data

```json
{
  "pvStrings": [
    {
      "voltage": 775.9,
      "current": 7.63,
      "power": 5920.117
    },
    {
      "voltage": 775.9,
      "current": 7.5,
      "power": 5819.25
    },
    {
      "voltage": 118,      // Disconnected string - low voltage
      "current": 0,        // No current
      "power": 0           // No power
    }
  ]
}
```

### Example 4: Error Handling

```json
{
  "inverters": [
    {
      "unitId": 99,
      "deviceName": "Inverter-99",
      "error": "Failed to read inverter data: Connection timeout"
    }
  ],
  "_metadata": {
    "operation": "specifyDevices",
    "inverterCount": 1,
    "timestamp": "2025-07-29T08:40:24.475Z",
    "success": true
  }
}
```

---

## Integration Guidelines

### For Data Processing Systems

1. **Always check `_metadata.success`** before processing data
2. **Handle partial data gracefully** - individual fields may be missing
3. **Use alarm bitfields for automated alerting** - check specific bits
4. **Use alarmTexts for human-readable notifications**
5. **Monitor deviceStatus for operational state**

### For Monitoring Dashboards

1. **Display both numeric and text alarm information**
2. **Use severity levels for alert coloring** (Major=Red, Minor=Yellow, Warning=Orange)
3. **Show PV string data as individual tiles/bars**
4. **Use efficiency percentage for performance indicators**
5. **Display temperature and insulation resistance for health monitoring**

### For Time-Series Databases

1. **Store alarm bitfields as separate metrics** for historical analysis
2. **Index by unitId and timestamp** for efficient querying
3. **Store power, voltage, current as separate time series**
4. **Use device status codes for operational state tracking**
5. **Store PV string data with string index as tag**

---

## Changelog

- **v0.0.10**: Added "Always Include Alarm Texts" toggle for consistent output structure
- **v0.0.9**: Added comprehensive direct register access with voltage readings and alarm system
- **v0.0.8**: Added manual device specification with flexible address parsing
- **v0.0.7**: Initial SUN2000 inverter node implementation

---

*This document covers n8n-nodes-huaweisolar version 0.0.10 and later.*