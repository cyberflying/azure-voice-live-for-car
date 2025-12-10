export const carTools = [
  {
    type: "function",
    name: "set_car_feature",
    description: "Control car features like lights, windows, music, and temperature.",
    parameters: {
      type: "object",
      properties: {
        feature: {
          type: "string",
          enum: ["lights", "windows", "music", "temperature", "speed"],
          description: "The car feature to control."
        },
        value: {
          type: "string",
          description: "The value to set the feature to (e.g., 'on', 'off', 'open', 'closed', '22', '100')."
        }
      },
      required: ["feature", "value"]
    }
  },
  {
    type: "function",
    name: "get_car_status",
    description: "Get the current status of the car.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "use_value_added_service",
    description: "Use a value-added service like navigation or entertainment.",
    parameters: {
      type: "object",
      properties: {
        serviceName: {
          type: "string",
          enum: ["navigation", "entertainment", "roadside_assistance"],
          description: "The name of the service to use."
        },
        action: {
          type: "string",
          description: "The action to perform (e.g., 'start', 'stop', 'search')."
        }
      },
      required: ["serviceName", "action"]
    }
  },
  {
    type: "function",
    name: "get_current_time",
    description: "Get the current time",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "The timezone to get the current time for, e.g., 'UTC', 'local'",
        }
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_current_weather",
    description: "Get the current weather in a given location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The city and state, e.g., 'San Francisco, CA'",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "The unit of temperature to use (celsius or fahrenheit)",
        },
      },
      required: ["location"],
    },
  }
];

export const executeCarTool = async (name, args, setCarStatus) => {
  console.log(`Executing tool: ${name}`, args);
  
  if (name === 'set_car_feature') {
    const { feature, value } = args;
    setCarStatus(prev => ({
      ...prev,
      [feature]: value
    }));
    return { success: true, message: `${feature} set to ${value}` };
  }
  
  if (name === 'get_car_status') {
    return { success: true, message: "Car status retrieved" }; 
  }

  if (name === 'use_value_added_service') {
    return { success: true, message: `Service ${args.serviceName} ${args.action} executed.` };
  }

  if (name === 'get_current_time') {
    const timezone = args.timezone || 'local';
    const now = new Date();
    const timeString = timezone.toLowerCase() === 'utc' ? now.toUTCString() : now.toLocaleString();
    return { 
        time: timeString, 
        timezone: timezone 
    };
  }

  if (name === 'get_current_weather') {
    const location = args.location || 'Unknown';
    const unit = args.unit || 'celsius';
    return {
        location: location,
        temperature: unit === 'celsius' ? 22 : 72,
        unit: unit,
        condition: "Partly Cloudy",
        humidity: 65,
        wind_speed: 10,
    };
  }

  return { success: false, message: "Unknown tool" };
};
