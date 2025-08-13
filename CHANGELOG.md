# Changelog

## [0.0.013] - 2025-08-13
### Changed
- **BREAKING CHANGE**: Restructured SUN2000 node output format for MQTT integration
- Node now outputs individual items instead of array wrapper format
- Each inverter generates 2 separate items: telemetry data + status/alarm data
- Added timestamp (`ts`) field to each output item
- Improved data separation for downstream processing and MQTT publishing

### Enhanced
- Better error handling for failed inverters (preserves unitId and deviceName)
- Optimized output structure for time-series databases
- Separated measurement data from status/alarm data for cleaner processing

## [0.0.012] - 2025-08-13
### Added
- Field Naming Convention toggle for both SmartLogger and SUN2000 nodes
- IEC 61850 standard naming support alongside descriptive field names
- Comprehensive field mapping for electrical parameters (P, Q, Ua, Ia, etc.)
- Zero-overhead performance implementation using direct field assignment
- Updated API documentation with field mapping reference and examples

### Enhanced
- Professional integration support with IEC 61850 standard field names
- Backward compatible with default descriptive naming
- Complete PV string naming support (voltage→U, current→I, power→P)
- Temperature field standardization (TempInt, TempCab, TempPV, TempAmb)
- Power and energy field alignment with international standards

## [0.0.010] - 2025-07-29
### Added
- "Always Include Alarm Texts" toggle option for consistent packet structure
- Option to include empty alarmTexts array even when no alarms are active
- Improved API consistency for downstream data processing

### Enhanced
- SUN2000 node UI with new boolean parameter for alarm text behavior
- Method signatures updated to support alarm text inclusion preference
- Better support for data analysis workflows requiring consistent output structure

## [0.0.009] - 2025-07-29
### Added
- Comprehensive direct register access for SUN2000 inverters
- Individual inverter voltage readings (AC grid line/phase voltages, DC string voltages)
- Device identification data (model, serial number, firmware version, rated power)
- Enhanced power & energy data (peak power today, daily/total energy yield, efficiency)
- Grid phase currents and frequency measurements
- PV string data with automatic string count detection (up to 24 strings)
- Device status and temperature readings (internal temperature, insulation resistance)
- Comprehensive alarm system with human-readable error messages
- Data category selection UI allowing users to choose specific data types to read
- Batch reading optimization for PV strings and other multi-register data

### Enhanced
- SUN2000InverterData interface expanded with ~40 new fields for comprehensive data
- readInverterData method now supports selective data category reading
- Improved error handling with partial data support
- Better performance through strategic use of Promise.all for parallel reads

### Technical
- Added direct register access methods for all SUN2000 documented registers
- Implemented alarm bit field decoding for all three alarm registers
- Added gain factor handling for accurate value conversion
- Comprehensive TypeScript typing for all new data fields

## [0.0.008] - 2025-07-29
### Added
- Manual device specification option with flexible address parsing (e.g., "1-2,6,8")
- SUN2000 inverter node with discovery integration support

## [0.0.007] - 2025-07-29
### Added
- Basic SUN2000 inverter node implementation
- Discovery data integration for automatic inverter reading

## [0.0.006] - 2025-07-29
### Fixed
- Emergency revert of breaking changes that caused package loading errors

## [0.0.005] - 2025-07-29
### Removed
- Unstable SUN2000 implementation that broke package loading

## [0.0.004] - 2025-07-29
### Enhanced
- Simplified SmartLogger UI from 6 operations to 2 with checkbox selection
- Improved user experience with clearer operation descriptions

## [0.0.003] - 2025-07-29
### Fixed
- Unit ID conflicts by creating dedicated client instances for discovery
- Performance issues with parallel device scanning

## [0.0.002] - 2025-07-29
### Fixed
- Critical SmartLogger communication issues (little-endian byte order, unit ID 3)
- Discovery reliability with proper error handling

## [0.0.001] - 2025-07-29
### Added
- Initial SmartLogger 3000 node implementation
- Basic Modbus TCP connection support
- Device discovery functionality