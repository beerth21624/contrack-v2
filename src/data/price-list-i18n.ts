export const PRICE_LIST_I18N: Record<string, { nameEn: string; uomEn: string }> = {
    // Step 0 : Land Survey
    'SRV-CREW': { nameEn: 'Survey Crew (2 Persons)', uomEn: 'man-day' },
    'SRV-EQUIP': { nameEn: 'Surveying Equipment Rental', uomEn: 'day' },
    'SRV-BM': { nameEn: 'BM Concrete Marker', uomEn: 'pt' },
    'SRV-MARKER': { nameEn: 'Land Boundary Check/Marker', uomEn: 'pt' },
    'SRV-TOPO': { nameEn: 'Topo Survey', uomEn: 'm2' },
    'SRV-METER': { nameEn: 'Temp Utilities Meter (Elec/Water)', uomEn: 'set' },
    'SRV-PERMIT': { nameEn: 'Permit Fees', uomEn: 'set' },
    'SRV-PHOTO': { nameEn: 'Pre-construction Site Photos', uomEn: 'set' },
  
    // Step 1 : Earthwork
    'FILL-SITE': { nameEn: 'Site Backfill & Compaction', uomEn: 'm3' },
    'FILL-SELECTED': { nameEn: 'Selected Fill & Compaction', uomEn: 'm3' },
    'FILL-SOFT': { nameEn: 'Soft Soil & Compaction', uomEn: 'm3' },
    'FILL-SAND-FILL': { nameEn: 'Sand Fill & Compaction', uomEn: 'm3' },
    'FILL-ROCK': { nameEn: 'Crushed Rock & Compaction', uomEn: 'm3' },
    'FILL-TRUCK': { nameEn: 'Soil Transport (6-wheel Dump Truck)', uomEn: 'trip' },
    'FILL-BACKHOE': { nameEn: 'Backhoe Rental', uomEn: 'hr' },
    'FILL-ROLLER': { nameEn: 'Roller Compactor Rental', uomEn: 'hr' },
    'FILL-FDT': { nameEn: 'Field Density Test (FDT)', uomEn: 'pt' },
  
    // Step 2 : Temp Utilities
    'UTIL-CABLE': { nameEn: 'Temp Electrical Cable', uomEn: 'm' },
    'UTIL-CONDUIT': { nameEn: 'Temp Electrical Conduit', uomEn: 'm' },
    'UTIL-PIPE': { nameEn: 'Temp Water Pipe', uomEn: 'm' },
    'UTIL-FITTING': { nameEn: 'Water Pipe Fittings/Valves', uomEn: 'set' },
    'UTIL-VALVE': { nameEn: 'Faucet / Gate Valve', uomEn: 'pcs' },
    'UTIL-DB': { nameEn: 'Temp Distribution Box', uomEn: 'cabinet' },
    'UTIL-GROUND': { nameEn: 'Ground Rod', uomEn: 'pcs' },
    'UTIL-TANK': { nameEn: 'Water Storage Tank', uomEn: 'L' },
    'UTIL-METER': { nameEn: 'Temp Meter (Elec+Water)', uomEn: 'set' },
    'UTIL-METER-E15': { nameEn: 'Temp Elec Meter 1-Phase 15(45)A', uomEn: 'set' },
    'UTIL-METER-E30': { nameEn: 'Temp Elec Meter 1-Phase 30(100)A', uomEn: 'set' },
    'UTIL-METER-E3P': { nameEn: 'Temp Elec Meter 3-Phase 30(100)A', uomEn: 'set' },
    'UTIL-METER-W15': { nameEn: 'Temp Water Meter 1/2"', uomEn: 'set' },
    'UTIL-METER-W20': { nameEn: 'Temp Water Meter 3/4"', uomEn: 'set' },
    'UTIL-PERMIT': { nameEn: 'District Permit Fee', uomEn: 'set' },
  
    // Step 3 : Site Prep
    'SITE-FENCE-ZINC': { nameEn: 'Corrugated Zinc Fence', uomEn: 'm2' },
    'SITE-FENCE-MESH': { nameEn: 'Wire Mesh Fence', uomEn: 'm2' },
    'SITE-FENCE-BLK': { nameEn: 'Concrete Block Fence', uomEn: 'm2' },
    'SITE-GATE': { nameEn: 'Site Entrance Gate', uomEn: 'unit' },
    'SITE-CAMP': { nameEn: 'Worker Camp / Storage', uomEn: 'm2' },
    'SITE-DRAIN': { nameEn: 'Temp Drainage Trench', uomEn: 'm' },
    'SITE-TOILET': { nameEn: 'Portable Toilet (per month)', uomEn: 'month' },
    'SITE-ROAD': { nameEn: 'Compacted Access Road', uomEn: 'm3' },
    'SITE-SIGN': { nameEn: 'Project Signboard', uomEn: 'pcs' },
    'SITE-SAFETY': { nameEn: 'Safety Sign', uomEn: 'pcs' },
  
    // Step 4 : Layout
    'LAYOUT-STR': { nameEn: 'Layout String', uomEn: 'm' },
    'LAYOUT-BOARD': { nameEn: 'Profile Board', uomEn: 'm' },
    'LAYOUT-STK': { nameEn: 'Column Center Stake', uomEn: 'pcs' },
    'LAYOUT-NAIL': { nameEn: 'Nails', uomEn: 'pcs' },
    'LAYOUT-MARKER': { nameEn: 'Concrete Center Marker', uomEn: 'pt' },
    'LAYOUT-SPRAY': { nameEn: 'Marking Spray Paint', uomEn: 'can' },
    'LAYOUT-CREW': { nameEn: 'Surveyor Labor (Layout)', uomEn: 'man-day' },
  
    // Step 5 : Piling
    'PILE-I15': { nameEn: 'Driven Pile I-15', uomEn: 'm' },
    'PILE-I18': { nameEn: 'Driven Pile I-18', uomEn: 'm' },
    'PILE-I22': { nameEn: 'Driven Pile I-22', uomEn: 'm' },
    'PILE-I26': { nameEn: 'Driven Pile I-26', uomEn: 'm' },
    'PILE-I30': { nameEn: 'Driven Pile I-30', uomEn: 'm' },
    'PILE-I35': { nameEn: 'Driven Pile I-35', uomEn: 'm' },
    'PILE-I40': { nameEn: 'Driven Pile I-40', uomEn: 'm' },
    'PILE-BRD-CON': { nameEn: 'Bored Pile Concrete', uomEn: 'm3' },
    'PILE-MACHINE': { nameEn: 'Pile Driving/Boring Machine', uomEn: 'day' },
    'PILE-TRANSPORT': { nameEn: 'Pile Transport', uomEn: 'trip' },
    'PILE-CUT': { nameEn: 'Cut Pile Head', uomEn: 'pcs' },
    'PILE-CAGE': { nameEn: 'Rebar Cage (Bored Pile)', uomEn: 'kg' },
    'PILE-BENTO': { nameEn: 'Bentonite Slurry', uomEn: 'm3' },
    'PILE-LOADTEST': { nameEn: 'Load Test (Dynamic/Static)', uomEn: 'pcs' },
  
    // Step 6 : Footing
    'FTG-EXC': { nameEn: 'Footing Excavation (Machine)', uomEn: 'm3' },
    'FTG-SAND': { nameEn: 'Compacted Sand Bedding', uomEn: 'm3' },
    'FTG-LEAN': { nameEn: 'Lean Concrete 1:3:5', uomEn: 'm3' },
    'FTG-CON': { nameEn: 'Footing Concrete 240 ksc', uomEn: 'm3' },
    'FTG-REBAR': { nameEn: 'Footing Rebar', uomEn: 'kg' },
    'FTG-WIRE': { nameEn: 'Tie Wire', uomEn: 'kg' },
    'FTG-SPACER': { nameEn: 'Concrete Spacer', uomEn: 'pcs' },
    'FTG-FORM': { nameEn: 'Footing Formwork', uomEn: 'm2' },
    'FTG-FILL': { nameEn: 'Backfill (Footing)', uomEn: 'm3' },
    'FTG-PUMP': { nameEn: 'Concrete Pump', uomEn: 'day' },
    'FTG-DEWATER': { nameEn: 'Dewatering Pump', uomEn: 'day' },
    'FTG-VIBRATOR': { nameEn: 'Concrete Vibrator', uomEn: 'day' },
    'FTG-CURING': { nameEn: 'Curing Compound / Plastic', uomEn: 'm2' },
  
    // Step 7 : Pedestal
    'PDS-CON': { nameEn: 'Pedestal Concrete 240 ksc', uomEn: 'm3' },
    'PDS-REBAR': { nameEn: 'Pedestal Rebar', uomEn: 'kg' },
    'PDS-WIRE': { nameEn: 'Tie Wire', uomEn: 'kg' },
    'PDS-SPACER': { nameEn: 'Concrete Spacer', uomEn: 'pcs' },
    'PDS-FORM': { nameEn: 'Pedestal Formwork', uomEn: 'm2' },
    'PDS-DOWEL': { nameEn: 'Dowel Bar (1st Floor)', uomEn: 'm' },
    'PDS-PUMP': { nameEn: 'Concrete Pump', uomEn: 'day' },
    'PDS-VIBRATOR': { nameEn: 'Concrete Vibrator', uomEn: 'day' },
    'PDS-CURING': { nameEn: 'Curing Compound / Plastic', uomEn: 'm2' },
  
    // Step 8 : Ground Beam
    'GBM-EXC': { nameEn: 'Ground Beam Excavation', uomEn: 'm3' },
    'GBM-SAND': { nameEn: 'Sand Bedding (Under Lean)', uomEn: 'm3' },
    'GBM-LEAN': { nameEn: 'Lean Concrete 1:3:5', uomEn: 'm3' },
    'GBM-CON': { nameEn: 'Ground Beam Concrete 240 ksc', uomEn: 'm3' },
    'GBM-REBAR': { nameEn: 'Ground Beam Rebar', uomEn: 'kg' },
    'GBM-WIRE': { nameEn: 'Tie Wire', uomEn: 'kg' },
    'GBM-SPACER': { nameEn: 'Concrete Spacer', uomEn: 'pcs' },
    'GBM-FORM': { nameEn: 'Ground Beam Formwork', uomEn: 'm2' },
    'GBM-FILL': { nameEn: 'Backfill (Ground Beam)', uomEn: 'm3' },
    'GBM-PUMP': { nameEn: 'Concrete Pump', uomEn: 'day' },
    'GBM-VIBRATOR': { nameEn: 'Concrete Vibrator', uomEn: 'day' },
    'GBM-CURING': { nameEn: 'Curing Compound / Plastic', uomEn: 'm2' },
  
    // Step 9 : Slab on Grade
    'SOG-SAND': { nameEn: 'Sand Bedding (Under Slab)', uomEn: 'm3' },
    'SOG-PLASTIC': { nameEn: 'Plastic Moisture Barrier', uomEn: 'm2' },
    'SOG-MESH': { nameEn: 'Wire Mesh', uomEn: 'kg' },
    'SOG-REBAR': { nameEn: 'Slab Rebar', uomEn: 'kg' },
    'SOG-CON': { nameEn: 'Slab Concrete 240 ksc', uomEn: 'm3' },
    'SOG-FORM-EDG': { nameEn: 'Edge Formwork', uomEn: 'm' },
    'SOG-CJOINT': { nameEn: 'Control Joint', uomEn: 'm' },
    'SOG-EJOINT': { nameEn: 'Expansion Joint (Sealant)', uomEn: 'm' },
    'SOG-PUMP': { nameEn: 'Concrete Pump', uomEn: 'day' },
    'SOG-VIBRATOR': { nameEn: 'Vibrating Screed', uomEn: 'day' },
    'SOG-CURING': { nameEn: 'Curing Compound / Plastic', uomEn: 'm2' },
    'SOG-HARDENER': { nameEn: 'Floor Hardener', uomEn: 'kg' },
    'SOG-SLEEVE': { nameEn: 'Sleeve', uomEn: 'pcs' },
  
    // Step 10 : Precast Slab
    'PCS-PANEL': { nameEn: 'Precast Slab (LL 250 kg/m²)', uomEn: 'm2' },
    'PCS-MESH': { nameEn: 'Wire Mesh (Topping)', uomEn: 'kg' },
    'PCS-TOP-CON': { nameEn: 'Topping Concrete 240 ksc', uomEn: 'm3' },
    'PCS-SHORE': { nameEn: 'Shoring', uomEn: 'm' },
    'PCS-GROUT': { nameEn: 'Joint Grout', uomEn: 'kg' },
    'PCS-CRANE': { nameEn: 'Crane Lifting', uomEn: 'day' },
    'PCS-PUMP': { nameEn: 'Topping Concrete Pump', uomEn: 'day' },
    'PCS-VIBRATOR': { nameEn: 'Vibrating Screed', uomEn: 'day' },
    'PCS-CURING': { nameEn: 'Curing Compound / Plastic', uomEn: 'm2' },
    'PCS-TERMITE': { nameEn: 'Termite Pipe', uomEn: 'm' },
    'PCS-DELIVER': { nameEn: 'Precast Slab Transport', uomEn: 'trip' },
  
    // Step 11 : Column Floor 1
    'COL-CON': { nameEn: 'Column Concrete 240 ksc (1st Fl)', uomEn: 'm3' },
    'COL-REBAR': { nameEn: 'Column Rebar (1st Fl)', uomEn: 'kg' },
    'COL-WIRE': { nameEn: 'Tie Wire', uomEn: 'kg' },
    'COL-SPACER': { nameEn: 'Concrete Spacer', uomEn: 'pcs' },
    'COL-FORM': { nameEn: 'Column Formwork (1st Fl)', uomEn: 'm2' },
    'COL-PUMP': { nameEn: 'Concrete Pump', uomEn: 'day' },
    'COL-VIBRATOR': { nameEn: 'Concrete Vibrator', uomEn: 'day' },
    'COL-CURING': { nameEn: 'Curing Compound / Plastic', uomEn: 'm2' },
  
    // Step 12 : Beam + Roof Deck
    'BMS-CON': { nameEn: 'Roof Beam Concrete 240 ksc', uomEn: 'm3' },
    'BMS-SLAB-CON': { nameEn: 'Roof Deck Slab Concrete 240 ksc', uomEn: 'm3' },
    'BMS-SLOPE': { nameEn: 'Slope Concrete', uomEn: 'm3' },
    'BMS-REBAR': { nameEn: 'Beam+Slab Rebar', uomEn: 'kg' },
    'BMS-WIRE': { nameEn: 'Tie Wire', uomEn: 'kg' },
    'BMS-SPACER': { nameEn: 'Concrete Spacer', uomEn: 'pcs' },
    'BMS-FORM': { nameEn: 'Beam+Slab Formwork', uomEn: 'm2' },
    'BMS-SHORE': { nameEn: 'Formwork Shoring', uomEn: 'pcs' },
    'BMS-WP': { nameEn: 'Waterproofing System', uomEn: 'm2' },
    'BMS-DRAIN': { nameEn: 'Roof Drain', uomEn: 'pcs' },
    'BMS-PUMP': { nameEn: 'Concrete Pump', uomEn: 'day' },
    'BMS-VIBRATOR': { nameEn: 'Concrete Vibrator', uomEn: 'day' },
    'BMS-CURING': { nameEn: 'Curing Compound / Plastic', uomEn: 'm2' },
  
    // Step 13 : Staircase
    'STR-CON': { nameEn: 'Staircase Concrete 240 ksc', uomEn: 'm3' },
    'STR-REBAR': { nameEn: 'Staircase Rebar', uomEn: 'kg' },
    'STR-WIRE': { nameEn: 'Tie Wire', uomEn: 'kg' },
    'STR-SPACER': { nameEn: 'Concrete Spacer', uomEn: 'pcs' },
    'STR-FORM': { nameEn: 'Staircase Formwork', uomEn: 'm2' },
    'STR-SHORE': { nameEn: 'Shoring', uomEn: 'pcs' },
    'STR-NOSING': { nameEn: 'Anti-slip Stair Nosing', uomEn: 'm' },
    'STR-PUMP': { nameEn: 'Concrete Pump', uomEn: 'day' },
    'STR-VIBRATOR': { nameEn: 'Concrete Vibrator', uomEn: 'day' },
    'STR-CURING': { nameEn: 'Curing Compound / Plastic', uomEn: 'm2' },
  
    // Step 14 : Column Cap Plate
    'CCP-STEEL': { nameEn: 'Steel Cap Plate', uomEn: 'kg' },
    'CCP-BOLT': { nameEn: 'J-Bolt / Anchor Bolt', uomEn: 'pcs' },
    'CCP-TEMPLATE': { nameEn: 'Bolt Template', uomEn: 'pt' },
    'CCP-GROUT': { nameEn: 'Non-shrink Grout', uomEn: 'bag' },
    'CCP-WELD': { nameEn: 'Welding', uomEn: 'm' },
    'CCP-PAINT': { nameEn: 'Anti-rust Paint', uomEn: 'm2' },
  
    // Step 15 : Roof Structure
    'RST-STEEL': { nameEn: 'Roof Steel Structure', uomEn: 'kg' },
    'RST-WELD': { nameEn: 'Welding Rods', uomEn: 'kg' },
    'RST-PAINT': { nameEn: 'Anti-rust Primer', uomEn: 'm2' },
    'RST-PURLIN': { nameEn: 'C-Purlin GZ', uomEn: 'm' },
    'RST-SCREW': { nameEn: 'Screws', uomEn: 'pcs' },
  
    // Step 16 : Roofing
    'ROF-CPAC': { nameEn: 'Concrete Roof Tile', uomEn: 'pcs' },
    'ROF-EXCELLA': { nameEn: 'Ceramic Roof Tile', uomEn: 'pcs' },
    'ROF-METAL': { nameEn: 'Metal Sheet Roof', uomEn: 'm2' },
    'ROF-CORR': { nameEn: 'Corrugated Roof Tile', uomEn: 'pcs' },
    'ROF-SHINGLE': { nameEn: 'Asphalt Shingle', uomEn: 'm2' },
    'ROF-CAP-TILE': { nameEn: 'Ridge/Hip Tile Cover', uomEn: 'pcs' },
    'ROF-CAP-MET': { nameEn: 'Metal Sheet Ridge/Hip Cover', uomEn: 'm' },
    'ROF-DRYTECH': { nameEn: 'Dry Tech System', uomEn: 'm' },
    'ROF-VALLEY': { nameEn: 'Valley Gutter', uomEn: 'm' },
    'ROF-EAVE': { nameEn: 'Fascia Board 8"+6"', uomEn: 'm' },
    'ROF-INSUL': { nameEn: 'Insulation (Foil/PE)', uomEn: 'm2' },
    'ROF-BIRD': { nameEn: 'Bird Guard', uomEn: 'm' },
  
    // Step 17 : Brickwork
    'BRK-CLAY': { nameEn: 'Clay Brick', uomEn: 'pcs' },
    'BRK-AAC': { nameEn: 'AAC Block', uomEn: 'pcs' },
    'BRK-MORTAR': { nameEn: 'Mortar', uomEn: 'm2' },
    'BRK-LINTEL': { nameEn: 'Lintel/Stiffener', uomEn: 'm' },
  
    // Step 18 : Plastering
    'PLS-EXT': { nameEn: 'Exterior Plastering', uomEn: 'm2' },
    'PLS-INT': { nameEn: 'Interior Plastering', uomEn: 'm2' },
    'PLS-SKIM': { nameEn: 'Skim Coat', uomEn: 'm2' },
  
    // Step 19 : Ceiling
    'CLG-PANEL': { nameEn: 'Ceiling Panel', uomEn: 'm2' },
    'CLG-FRAME': { nameEn: 'C-Line Frame', uomEn: 'm' },
    'CLG-CORNICE': { nameEn: 'Cornice', uomEn: 'm' },
  
    // Step 20 : Floor Tile
    'FLT-TILE': { nameEn: 'Floor Tile (incl. installation)', uomEn: 'm2' },
    'FLT-ADHESIVE': { nameEn: 'Tile Adhesive (20kg)', uomEn: 'pcs' },
    'FLT-SKIRTING': { nameEn: 'Skirting Board', uomEn: 'm' },
  
    // Step 21 : Bath Tile
    'BTL-FLOOR': { nameEn: 'Bathroom Floor Tile', uomEn: 'm2' },
    'BTL-WALL': { nameEn: 'Bathroom Wall Tile', uomEn: 'm2' },
    'BTL-WP': { nameEn: 'Waterproofing', uomEn: 'm2' },
  
    // Step 22 : Exterior Finish
    'EXF-MAT': { nameEn: 'Exterior Finishing Material', uomEn: 'm2' },
  
    // Step 23 : Primer
    'PRM-INT': { nameEn: 'Interior Primer (Gallon)', uomEn: 'gal' },
    'PRM-EXT': { nameEn: 'Exterior Primer (Gallon)', uomEn: 'gal' },
    'PRM-SAND': { nameEn: 'Sandpaper', uomEn: 'pcs' },
    'PRM-CRACK': { nameEn: 'Acrylic Sealant 300ml', uomEn: 'pcs' },
    'PRM-ROLLER': { nameEn: 'Paint Roller Set', uomEn: 'set' },
    'PRM-BRUSH': { nameEn: 'Paint Brush 2-3"', uomEn: 'pcs' },
  
    // Step 24 : Aluminium
    'ALU-DOOR': { nameEn: 'Aluminium Door Set', uomEn: 'set' },
    'ALU-DOOR-A': { nameEn: 'Aluminium Door Area', uomEn: 'm2' },
    'ALU-SLIDE': { nameEn: 'Aluminium Sliding Door Set', uomEn: 'set' },
    'ALU-WINDOW': { nameEn: 'Aluminium Window Set', uomEn: 'set' },
    'ALU-WIN-A': { nameEn: 'Aluminium Window Area', uomEn: 'm2' },
    'ALU-SEAL': { nameEn: 'PU Sealant', uomEn: 'm' },
  
    // Step 25 : Paint 1
    'PNT-INT': { nameEn: 'Interior Top Coat (Gallon)', uomEn: 'gal' },
    'PNT-ACCENT': { nameEn: 'Accent Color Coat (Gallon)', uomEn: 'gal' },
    'PNT-EXT': { nameEn: 'Exterior Top Coat (Gallon)', uomEn: 'gal' },
    'PNT-WOOD': { nameEn: 'Wood Stain/Lacquer (Gallon)', uomEn: 'gal' },
    'PNT-ROLLER': { nameEn: 'Paint Roller Set', uomEn: 'set' },
    'PNT-MASK': { nameEn: 'Masking Tape', uomEn: 'pcs' },
    'PNT-DROP': { nameEn: 'Drop Cloth', uomEn: 'pcs' },
  
    // Step 26 : Electrical
    'ELC-CONDUIT': { nameEn: 'PVC Conduit Pipe', uomEn: 'm' },
    'ELC-MAIN': { nameEn: 'Main Wire THW', uomEn: 'm' },
    'ELC-BRANCH': { nameEn: 'Branch Wire VAF', uomEn: 'm' },
    'ELC-AC': { nameEn: 'AC Wire VCT', uomEn: 'm' },
    'ELC-SOCKET': { nameEn: 'Switch / Socket', uomEn: 'pcs' },
    'ELC-LIGHT': { nameEn: 'Light Fixture', uomEn: 'pcs' },
    'ELC-CU': { nameEn: 'Consumer Unit + Breaker', uomEn: 'set' },
    'ELC-GROUND': { nameEn: 'Ground Rod', uomEn: 'pcs' },
    'ELC-OUT': { nameEn: 'Outdoor Socket IP55', uomEn: 'pcs' },
    'ELC-EV': { nameEn: 'EV Charger Wall Box', uomEn: 'set' },
  
    // Step 27 : San Int
    'SIP-SUPPLY': { nameEn: 'Water Supply Pipe PVC', uomEn: 'm' },
    'SIP-DRAIN': { nameEn: 'Drain Pipe PVC', uomEn: 'm' },
    'SIP-HOT': { nameEn: 'Hot Water Pipe PPR', uomEn: 'm' },
    'SIP-VALVE': { nameEn: 'Stop/Gate Valve', uomEn: 'pcs' },
    'SIP-FD': { nameEn: 'Floor Drain (Stainless)', uomEn: 'set' },
    'SIP-PTRAP': { nameEn: 'P-Trap', uomEn: 'pcs' },
    'SIP-CO': { nameEn: 'Cleanout Box', uomEn: 'pcs' },
  
    // Step 28 : San Ext
    'SEP-SUPPLY': { nameEn: 'Main Supply Pipe HDPE/PVC', uomEn: 'm' },
    'SEP-DRAIN': { nameEn: 'Drain Pipe PVC', uomEn: 'm' },
    'SEP-CHAMBER': { nameEn: 'Inspection Chamber', uomEn: 'pit' },
    'SEP-SEPTIC': { nameEn: 'Septic Tank', uomEn: 'set' },
    'SEP-GREASE': { nameEn: 'Grease Trap', uomEn: 'set' },
    'SEP-METER': { nameEn: 'Water Meter + Request', uomEn: 'set' },
    'SEP-RAIN': { nameEn: 'Rain Gutter PVC', uomEn: 'm' },
    'SEP-PUMP': { nameEn: 'Water Pump + Tank', uomEn: 'set' },
  
    // Step 29 : Misc
    'MSC-CURTAIN': { nameEn: 'Curtain Rail', uomEn: 'm' },
    'MSC-BLIND': { nameEn: 'Blinds/Roller Shade', uomEn: 'set' },
    'MSC-TOWEL': { nameEn: 'Towel Rack', uomEn: 'pcs' },
    'MSC-SOAP': { nameEn: 'Soap Dispenser', uomEn: 'pcs' },
    'MSC-PAPER': { nameEn: 'Toilet Paper Holder', uomEn: 'pcs' },
    'MSC-MIRROR': { nameEn: 'Mirror + Frame', uomEn: 'set' },
    'MSC-STOPPER': { nameEn: 'Door Stopper', uomEn: 'pcs' },
    'MSC-CLOSER': { nameEn: 'Door Closer', uomEn: 'pcs' },
    'MSC-PEEP': { nameEn: 'Peephole', uomEn: 'pcs' },
    'MSC-HNUM': { nameEn: 'House Number', uomEn: 'set' },
    'MSC-SHELF': { nameEn: 'Shelf / Shoe Rack', uomEn: 'set' },
    'MSC-CABINET': { nameEn: 'Built-in Cabinet', uomEn: 'pcs' },
    'MSC-MAIL': { nameEn: 'Mailbox', uomEn: 'set' },
    'MSC-CLOTH': { nameEn: 'Clothes Rack', uomEn: 'm' },
  
    // Step 30 : Sanitary Fix
    'SFX-TOILET': { nameEn: 'Toilet Bowl Set', uomEn: 'set' },
    'SFX-BASIN': { nameEn: 'Wash Basin Set', uomEn: 'set' },
    'SFX-SHOWER': { nameEn: 'Shower Set', uomEn: 'set' },
    'SFX-BIDET': { nameEn: 'Bidet Spray', uomEn: 'set' },
    'SFX-FAUCET': { nameEn: 'Faucet', uomEn: 'pcs' },
    'SFX-KSINK': { nameEn: 'Kitchen Sink Set', uomEn: 'set' },
    'SFX-KFAUCET': { nameEn: 'Kitchen Faucet', uomEn: 'pcs' },
    'SFX-HEATER': { nameEn: 'Water Heater Set', uomEn: 'set' },
    'SFX-TUB': { nameEn: 'Bathtub Set', uomEn: 'set' },
    'SFX-URINAL': { nameEn: 'Urinal Set', uomEn: 'set' },
    'SFX-LSINK': { nameEn: 'Laundry Sink Set', uomEn: 'set' },
    'SFX-SILI': { nameEn: 'Sanitary Silicone', uomEn: 'pcs' },
    'SFX-PTFE': { nameEn: 'PTFE Thread Seal Tape', uomEn: 'pcs' },
  
    // Step 31 : Wood Door
    'WDR-DOOR': { nameEn: 'Wooden Door Set', uomEn: 'set' },
    'WDR-WINDOW': { nameEn: 'Wooden Window Set', uomEn: 'set' },
    'WDR-HARDWARE': { nameEn: 'Hardware (Lock/Hinges)', uomEn: 'set' },
    'WDR-SEAL': { nameEn: 'PU Sealant', uomEn: 'pcs' },
    'WDR-FINISH': { nameEn: 'Wood Stain (Gallon)', uomEn: 'gal' },
  
    // Step 32 : Paint 2
    'FPT-INT': { nameEn: 'Interior Top Coat 2 (Gallon)', uomEn: 'gal' },
    'FPT-EXT': { nameEn: 'Exterior Top Coat 2 (Gallon)', uomEn: 'gal' },
    'FPT-WOOD': { nameEn: 'Wood Stain 2 (Gallon)', uomEn: 'gal' },
    'FPT-TOUCH': { nameEn: 'Touch-up Paint', uomEn: 'm2' },
    'FPT-ROLLER': { nameEn: 'Paint Roller Replacement', uomEn: 'set' },
    'FPT-BRUSH': { nameEn: 'Paint Brush', uomEn: 'set' },
  
    // Step 33 : Defect
    'DEF-ITEM': { nameEn: 'Defect Repair (Item)', uomEn: 'pcs' },
    'DEF-CLEAN': { nameEn: 'Big Cleaning', uomEn: 'm2' },
    'DEF-TOUCH': { nameEn: 'Touch-up', uomEn: 'm2' },
    'DEF-CAULK': { nameEn: 'Crack Repair', uomEn: 'm' },
    'DEF-SUPPLY': { nameEn: 'Cleaning Supplies', uomEn: 'set' },
    'DEF-STICKER': { nameEn: 'Defect Sticker', uomEn: 'set' },
  
    // Step 34 : Handover
    'HDV-DOC': { nameEn: 'As-built / Manual Book', uomEn: 'set' },
    'HDV-KEY': { nameEn: 'Key Set', uomEn: 'set' },
    'HDV-WARR': { nameEn: 'Warranty Document', uomEn: 'set' },
    'HDV-DWG': { nameEn: 'As-built Drawing', uomEn: 'set' },
    'HDV-MANUAL': { nameEn: 'Equipment Manuals', uomEn: 'set' },
    'HDV-PHOTO': { nameEn: 'Project Photos (USB/Cloud)', uomEn: 'set' },
    'HDV-TRAIN': { nameEn: 'Usage Training', uomEn: 'day' }
  };
  
