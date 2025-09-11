import json
import random
import itertools
import math
from typing import Dict, List, Tuple, Any

class TLOFTrainingDataGenerator:
    """
    High-quality training data generator for TLOF configurations.
    Generates diverse, realistic training examples covering all parameters.
    """
    
    def __init__(self):
        # Aircraft types with realistic characteristics
        self.aircraft_configs = {
            "helicopter": {"typical_size": (15, 25), "weight_class": "medium"},
            "tiltrotor": {"typical_size": (18, 35), "weight_class": "heavy"},
            "drone": {"typical_size": (2, 8), "weight_class": "light"},
            "eVTOL": {"typical_size": (8, 15), "weight_class": "light"},
            "urban_air_mobility": {"typical_size": (10, 20), "weight_class": "medium"},
            "emergency_helicopter": {"typical_size": (12, 18), "weight_class": "medium"},
            "cargo_drone": {"typical_size": (5, 12), "weight_class": "medium"},
            "passenger_eVTOL": {"typical_size": (12, 25), "weight_class": "heavy"}
        }
        
        self.shape_types = ["Rectangle", "Circle", "Polygon"]
        self.colors = ["white", "yellow", "blue", "red", "green", "black", "purple", "orange", "gray", "brown"]
        self.landing_markers = ["H", "V"]
        self.marking_types = ["solid", "dashed"]
        self.tdpc_types = ["circle", "cross", "square"]
        self.safety_area_types = ["offset", "multiplier"]
        
        # Realistic location clusters (major cities worldwide)
        self.location_clusters = [
            {"center": [139.6917, 35.6895], "name": "Tokyo", "radius": 0.5},
            {"center": [-74.0060, 40.7128], "name": "New York", "radius": 0.3},
            {"center": [2.3522, 48.8566], "name": "Paris", "radius": 0.2},
            {"center": [-0.1276, 51.5074], "name": "London", "radius": 0.3},
            {"center": [13.4050, 52.5200], "name": "Berlin", "radius": 0.2},
            {"center": [151.2093, -33.8688], "name": "Sydney", "radius": 0.4},
            {"center": [-118.2437, 34.0522], "name": "Los Angeles", "radius": 0.5},
            {"center": [103.8198, 1.3521], "name": "Singapore", "radius": 0.1},
            {"center": [55.2708, 25.2048], "name": "Dubai", "radius": 0.3},
            {"center": [-43.1729, -22.9068], "name": "Rio de Janeiro", "radius": 0.2}
        ]

    def generate_realistic_coordinates(self) -> List[float]:
        """Generate realistic coordinates near major cities"""
        cluster = random.choice(self.location_clusters)
        center_lng, center_lat = cluster["center"]
        radius = cluster["radius"]
        
        # Generate random offset within radius
        angle = random.uniform(0, 2 * math.pi)
        distance = random.uniform(0, radius)
        
        lng = center_lng + distance * math.cos(angle)
        lat = center_lat + distance * math.sin(angle)
        
        return [round(lng, 4), round(lat, 4)]

    def generate_aircraft_appropriate_dimensions(self, aircraft: str, shape_type: str) -> Tuple[int, int, float]:
        """Generate realistic dimensions based on aircraft type"""
        config = self.aircraft_configs.get(aircraft, self.aircraft_configs["helicopter"])
        min_size, max_size = config["typical_size"]
        
        # Base size with some variation
        base_size = random.randint(min_size, max_size)
        
        if shape_type == "Rectangle":
            # Rectangular TLOFs often have length > width
            width = base_size
            length = random.randint(base_size, int(base_size * 1.5))
        elif shape_type == "Circle":
            # For circles, width = length = diameter
            width = length = base_size
        else:  # Polygon
            # Polygons use average dimension
            width = length = base_size
            
        # Height based on aircraft weight class
        if config["weight_class"] == "light":
            height = round(random.uniform(0.1, 2.0), 2)
        elif config["weight_class"] == "medium":
            height = round(random.uniform(1.0, 4.0), 2)
        else:  # heavy
            height = round(random.uniform(2.0, 5.0), 2)
            
        return width, length, height

    def generate_natural_language_description(self, params: Dict[str, Any]) -> str:
        """Generate natural, varied language descriptions"""
        templates = [
            "Create a {shape} TLOF for {aircraft}",
            "Generate a {shape} landing pad for {aircraft}",
            "Design a {shape} touchdown area for {aircraft}",
            "Build a {shape} TLOF suitable for {aircraft}",
            "I need a {shape} landing surface for {aircraft}"
        ]
        
        template = random.choice(templates)
        description_parts = [template.format(
            shape=params["shape_type"].lower(),
            aircraft=params["aircraft"].replace("_", " ")
        )]
        
        # Add dimensions with natural variation
        if params["shape_type"] == "Rectangle":
            dim_templates = [
                "with dimensions {width}m x {length}m",
                "measuring {width}m by {length}m",
                "sized {width}m × {length}m",
                "with {width}m width and {length}m length"
            ]
            description_parts.append(random.choice(dim_templates).format(
                width=params["width"], length=params["length"]
            ))
        elif params["shape_type"] == "Circle":
            dim_templates = [
                "with {diameter}m diameter",
                "with a diameter of {diameter}m",
                "measuring {diameter}m across"
            ]
            description_parts.append(random.choice(dim_templates).format(
                diameter=params["width"]
            ))
        else:  # Polygon
            description_parts.append(f"with {params['sides']} sides and {params['width']}m width")
        
        # Add optional parameters with natural language
        if params["elevation"] > 0:
            elev_templates = [
                "at {elevation}m elevation",
                "elevated {elevation}m above ground",
                "with base height of {elevation}m",
                "{elevation}m above sea level"
            ]
            description_parts.append(random.choice(elev_templates).format(elevation=params["elevation"]))
        
        if params["rotation"] > 0:
            rot_templates = [
                "rotated {rotation} degrees",
                "with {rotation}° rotation",
                "oriented at {rotation} degrees"
            ]
            description_parts.append(random.choice(rot_templates).format(rotation=params["rotation"]))
        
        if params["transparency"] < 1.0:
            trans_templates = [
                "with {transparency} transparency",
                "at {transparency} opacity",
                "{transparency} transparent"
            ]
            description_parts.append(random.choice(trans_templates).format(transparency=params["transparency"]))
        
        # Add location
        description_parts.append(f"Location coordinates: [{params['position'][0]}, {params['position'][1]}]")
        
        # Add landing marker if enabled
        if params["landing_marker_enabled"]:
            marker_templates = [
                "Add a '{marker}' landing marker in {color}",
                "Include a {color} '{marker}' marker",
                "Place a {color} '{marker}' symbol",
                "With a {color} '{marker}' landing indicator"
            ]
            marker_desc = random.choice(marker_templates).format(
                marker=params["landing_marker"],
                color=params["marker_color"]
            )
            if params["marker_scale"] != 5:
                marker_desc += f" scaled to {params['marker_scale']}"
            if params["marker_rotation"] > 0:
                marker_desc += f" rotated {params['marker_rotation']} degrees"
            description_parts.append(marker_desc)
        
        # Add markings if enabled
        if params["marking_enabled"]:
            marking_templates = [
                "with {type} markings in {color}",
                "featuring {color} {type} boundary lines",
                "including {type} {color} perimeter markings"
            ]
            description_parts.append(random.choice(marking_templates).format(
                type=params["marking_type"],
                color=params["marking_color"]
            ))
        
        # Add lighting if enabled
        if params["light_enabled"]:
            light_templates = [
                "with {color} perimeter lighting",
                "including {color} LED lights around the edge",
                "equipped with {color} boundary lights"
            ]
            description_parts.append(random.choice(light_templates).format(
                color=params["light_color"]
            ))
        
        # Add safety features
        if params["safety_area_enabled"]:
            description_parts.append("with safety area included")
        
        if params["safety_net_enabled"]:
            description_parts.append("including safety netting")
        
        # Join with natural connectors
        connectors = [", ", ". ", ", and ", ". Also, ", ". Include "]
        result = description_parts[0]
        for i, part in enumerate(description_parts[1:], 1):
            if i == len(description_parts) - 1 and len(description_parts) > 2:
                result += ", and " + part
            else:
                result += random.choice(connectors[:2]) + part
        
        return result + "."

    def generate_single_example(self) -> Dict[str, Any]:
        """Generate one high-quality training example"""
        # Select aircraft and appropriate parameters
        aircraft = random.choice(list(self.aircraft_configs.keys()))
        shape_type = random.choice(self.shape_types)
        position = self.generate_realistic_coordinates()
        
        # Generate appropriate dimensions
        width, length, height = self.generate_aircraft_appropriate_dimensions(aircraft, shape_type)
        
        # Basic parameters with realistic constraints
        rotation = random.randint(0, 359)
        transparency = round(random.uniform(0.3, 1.0), 1)  # Usually not too transparent
        elevation = random.choice([0] * 3 + list(range(1, 51)))  # Ground level most common
        
        # Feature enablement (realistic probabilities)
        marking_enabled = random.random() < 0.8  # 80% have markings
        landing_marker_enabled = random.random() < 0.9  # 90% have landing markers
        light_enabled = random.random() < 0.6  # 60% have lighting
        tdpc_enabled = random.random() < 0.3  # 30% have TDPC
        safety_area_enabled = random.random() < 0.4  # 40% have safety area
        safety_net_enabled = random.random() < 0.2  # 20% have safety net
        
        # Generate feature-specific parameters
        marking_type = random.choice(self.marking_types) if marking_enabled else "dashed"
        marking_color = random.choice(self.colors) if marking_enabled else "white"
        marking_thickness = round(random.uniform(0.1, 1.5), 1) if marking_enabled else 0.5
        
        landing_marker = random.choice(self.landing_markers) if landing_marker_enabled else "H"
        marker_color = random.choice(self.colors) if landing_marker_enabled else "white"
        marker_scale = random.randint(1, 20) if landing_marker_enabled else 5
        marker_rotation = random.randint(0, 359) if landing_marker_enabled else 0
        
        light_color = random.choice(self.colors) if light_enabled else "white"
        light_scale = random.randint(-20, 100) if light_enabled else 1
        light_distance = random.randint(1, 50) if light_enabled else 1
        
        # Polygon-specific
        sides = random.randint(4, 8) if shape_type == "Polygon" else 4
        
        # Package parameters for description generation
        params = {
            "aircraft": aircraft,
            "shape_type": shape_type,
            "position": position,
            "width": width,
            "length": length,
            "height": height,
            "rotation": rotation,
            "transparency": transparency,
            "elevation": elevation,
            "sides": sides,
            "marking_enabled": marking_enabled,
            "marking_type": marking_type,
            "marking_color": marking_color,
            "landing_marker_enabled": landing_marker_enabled,
            "landing_marker": landing_marker,
            "marker_color": marker_color,
            "marker_scale": marker_scale,
            "marker_rotation": marker_rotation,
            "light_enabled": light_enabled,
            "light_color": light_color,
            "safety_area_enabled": safety_area_enabled,
            "safety_net_enabled": safety_net_enabled
        }
        
        # Generate natural language description
        user_input = self.generate_natural_language_description(params)
        
        # Generate complete JSON response
        tlof_json = {
            "TLOF": [
                {
                    "position": position,
                    "dimensions": {
                        "unit": "m",
                        "aircraftCategory": False,
                        "aircraft": aircraft,
                        "diameter": width,
                        "isVisible": True,
                        "layerName": f"Generated_TLOF_{aircraft}",
                        "shapeType": shape_type,
                        "scaleCategory": False,
                        "textureScaleU": 1,
                        "textureScaleV": 1,
                        "safetyNetScaleU": 1,
                        "safetyNetScaleV": 1,
                        "sides": sides,
                        "width": width,
                        "length": length,
                        "height": height,
                        "rotation": rotation,
                        "transparency": transparency,
                        "baseHeight": elevation,
                        
                        # Markings
                        "markingsCategory": marking_enabled,
                        "markingType": marking_type,
                        "markingColor": marking_color,
                        "markingThickness": marking_thickness,
                        "dashDistance": round(random.uniform(0.5, 5), 1) if marking_type == "dashed" else 1.5,
                        "dashLength": round(random.uniform(0.5, 5), 1) if marking_type == "dashed" else 1.0,
                        
                        # Landing Marker
                        "landingMarkerCategory": landing_marker_enabled,
                        "landingMarker": landing_marker,
                        "markerScale": marker_scale,
                        "markerThickness": round(random.uniform(0.1, 1.0), 2),
                        "markerRotation": marker_rotation,
                        "markerColor": marker_color,
                        "letterThickness": round(random.uniform(0.05, 0.5), 2),
                        
                        # TDPC
                        "tdpcCategory": tdpc_enabled,
                        "tdpcType": random.choice(self.tdpc_types),
                        "tdpcScale": random.randint(1, 50) if tdpc_enabled else 5,
                        "tdpcThickness": round(random.uniform(0.1, 2.0), 1) if tdpc_enabled else 0.5,
                        "tdpcRotation": random.randint(0, 359) if tdpc_enabled else 0,
                        "tdpcExtrusion": round(random.uniform(0.01, 0.1), 3),
                        "tdpcColor": random.choice(self.colors) if tdpc_enabled else "white",
                        
                        # Lighting
                        "lightCategory": light_enabled,
                        "lightColor": light_color,
                        "lightScale": light_scale,
                        "lightDistance": light_distance,
                        "lightRadius": round(random.uniform(0.1, 1.0), 1),
                        "lightHeight": round(random.uniform(0.1, 0.25), 2),
                        
                        # Safety Area
                        "safetyAreaCategory": safety_area_enabled,
                        "safetyAreaType": random.choice(self.safety_area_types),
                        "dValue": random.randint(5, 20) if safety_area_enabled else 10,
                        "multiplier": round(random.uniform(1.0, 3.0), 1) if safety_area_enabled else 1.5,
                        "offsetDistance": random.randint(1, 20) if safety_area_enabled else 3,
                        
                        # Safety Net
                        "safetyNetCategory": safety_net_enabled,
                        "curveAngle": random.randint(30, 90) if safety_net_enabled else 45,
                        "netHeight": random.randint(10, 30) if safety_net_enabled else 15,
                        "safetyNetTransparency": round(random.uniform(0.3, 0.8), 1),
                        "safetyNetColor": "#FF0000"
                    }
                }
            ]
        }
        
        return {
            "messages": [
                {"role": "user", "content": user_input},
                {"role": "assistant", "content": json.dumps(tlof_json, separators=(',', ':'))}  # Compact JSON
            ]
        }

    def generate_dataset(self, num_examples: int = 3000, validation_split: float = 0.2) -> Tuple[List[Dict], List[Dict]]:
        """Generate complete training and validation datasets"""
        print(f"Generating {num_examples} high-quality training examples...")
        
        all_examples = []
        for i in range(num_examples):
            example = self.generate_single_example()
            all_examples.append(example)
            
            if (i + 1) % 500 == 0:
                print(f"Generated {i + 1}/{num_examples} examples...")
        
        # Split into training and validation
        split_point = int(num_examples * (1 - validation_split))
        random.shuffle(all_examples)
        
        training_examples = all_examples[:split_point]
        validation_examples = all_examples[split_point:]
        
        print(f"✅ Generated {len(training_examples)} training examples")
        print(f"✅ Generated {len(validation_examples)} validation examples")
        
        return training_examples, validation_examples

    def save_dataset(self, training_examples: List[Dict], validation_examples: List[Dict], 
                    train_filename: str = "tlof_training_data.jsonl",
                    val_filename: str = "tlof_validation_data.jsonl"):
        """Save datasets in JSONL format"""
        
        # Save training data
        with open(train_filename, 'w') as f:
            for example in training_examples:
                f.write(json.dumps(example) + '\n')
        
        # Save validation data
        with open(val_filename, 'w') as f:
            for example in validation_examples:
                f.write(json.dumps(example) + '\n')
        
        print(f"💾 Saved {len(training_examples)} training examples to {train_filename}")
        print(f"💾 Saved {len(validation_examples)} validation examples to {val_filename}")

    def validate_dataset(self, filename: str) -> bool:
        """Comprehensive dataset validation"""
        print(f"🔍 Validating dataset: {filename}")
        
        valid_count = 0
        total_count = 0
        issues = []
        
        with open(filename, 'r') as f:
            for line_num, line in enumerate(f, 1):
                total_count += 1
                try:
                    data = json.loads(line)
                    
                    # Check structure
                    if "messages" not in data or len(data["messages"]) != 2:
                        issues.append(f"Line {line_num}: Invalid message structure")
                        continue
                    
                    # Check roles
                    if (data["messages"][0]["role"] != "user" or 
                        data["messages"][1]["role"] != "assistant"):
                        issues.append(f"Line {line_num}: Invalid roles")
                        continue
                    
                    # Check content exists
                    if not data["messages"][0]["content"] or not data["messages"][1]["content"]:
                        issues.append(f"Line {line_num}: Empty content")
                        continue
                    
                    # Validate JSON response
                    try:
                        assistant_json = json.loads(data["messages"][1]["content"])
                        if "TLOF" not in assistant_json:
                            issues.append(f"Line {line_num}: Missing TLOF key in response")
                            continue
                    except json.JSONDecodeError:
                        issues.append(f"Line {line_num}: Invalid JSON in assistant response")
                        continue
                    
                    valid_count += 1
                    
                except json.JSONDecodeError:
                    issues.append(f"Line {line_num}: Invalid JSON structure")
        
        # Report results
        print(f"📊 Validation Results:")
        print(f"   Valid examples: {valid_count}/{total_count}")
        print(f"   Success rate: {(valid_count/total_count)*100:.1f}%")
        
        if issues:
            print(f"⚠️  Found {len(issues)} issues:")
            for issue in issues[:10]:  # Show first 10 issues
                print(f"   - {issue}")
            if len(issues) > 10:
                print(f"   ... and {len(issues) - 10} more issues")
        else:
            print("✅ No validation issues found!")
        
        return len(issues) == 0

def main():
    """Main execution function"""
    print("🚀 TLOF Training Data Generator")
    print("=" * 50)
    
    # Initialize generator
    generator = TLOFTrainingDataGenerator()
    
    # Generate datasets
    training_examples, validation_examples = generator.generate_dataset(
        num_examples=3000,  # High-quality dataset
        validation_split=0.2
    )
    
    # Save datasets
    generator.save_dataset(training_examples, validation_examples)
    
    # Validate datasets
    train_valid = generator.validate_dataset("tlof_training_data.jsonl")
    val_valid = generator.validate_dataset("tlof_validation_data.jsonl")
    
    if train_valid and val_valid:
        print("\n🎉 SUCCESS! High-quality training data is ready!")
        print("\n📋 Dataset Summary:")
        print(f"   Training examples: {len(training_examples)}")
        print(f"   Validation examples: {len(validation_examples)}")
        print(f"   Total examples: {len(training_examples) + len(validation_examples)}")
        print("\n🔥 Quality Features:")
        print("   ✅ Realistic aircraft-appropriate dimensions")
        print("   ✅ Natural language variation (5+ templates)")
        print("   ✅ Geographically distributed coordinates")
        print("   ✅ Balanced feature representation")
        print("   ✅ Comprehensive parameter coverage")
        print("   ✅ Validated JSON structure")
        print("\n▶️  Next step: Run 'python azure_finetune.py' to start training!")
    else:
        print("❌ Dataset validation failed. Please check the issues above.")

if __name__ == "__main__":
    main() 