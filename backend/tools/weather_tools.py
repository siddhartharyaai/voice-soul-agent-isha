"""
Weather integration tools using OpenWeatherMap API
"""

import os
import json
from typing import Dict, Any
import logging
import httpx

logger = logging.getLogger(__name__)

class WeatherTools:
    def __init__(self):
        self.api_key = os.getenv("OPENWEATHER_API_KEY")
        self.base_url = "http://api.openweathermap.org/data/2.5"
    
    async def get_current_weather(self, parameters: Dict[str, Any]) -> str:
        """Get current weather for a location"""
        try:
            location = parameters.get('location')
            units = parameters.get('units', 'metric')
            
            if not location:
                return "Error: Missing required parameter 'location'"
            
            if not self.api_key:
                return "Error: OpenWeatherMap API key not configured"
            
            # Prepare API request
            params = {
                'q': location,
                'appid': self.api_key,
                'units': units
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/weather",
                    params=params,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Extract weather information
                    main = data.get('main', {})
                    weather = data.get('weather', [{}])[0]
                    wind = data.get('wind', {})
                    sys = data.get('sys', {})
                    
                    temp = main.get('temp')
                    feels_like = main.get('feels_like')
                    humidity = main.get('humidity')
                    pressure = main.get('pressure')
                    description = weather.get('description', '').title()
                    wind_speed = wind.get('speed')
                    country = sys.get('country', '')
                    city_name = data.get('name', location)
                    
                    # Format temperature unit
                    temp_unit = '°C' if units == 'metric' else '°F' if units == 'imperial' else 'K'
                    
                    result = f"🌤️ Current weather in {city_name}"
                    if country:
                        result += f", {country}"
                    result += ":\n\n"
                    
                    result += f"**Condition:** {description}\n"
                    result += f"**Temperature:** {temp}{temp_unit}"
                    if feels_like:
                        result += f" (feels like {feels_like}{temp_unit})"
                    result += "\n"
                    
                    if humidity:
                        result += f"**Humidity:** {humidity}%\n"
                    if pressure:
                        result += f"**Pressure:** {pressure} hPa\n"
                    if wind_speed:
                        wind_unit = 'm/s' if units == 'metric' else 'mph' if units == 'imperial' else 'm/s'
                        result += f"**Wind Speed:** {wind_speed} {wind_unit}\n"
                    
                    return result
                    
                elif response.status_code == 404:
                    return f"Error: Location '{location}' not found"
                else:
                    logger.error(f"OpenWeatherMap API error: {response.status_code} - {response.text}")
                    return f"Error: Weather API returned status {response.status_code}"
                    
        except Exception as e:
            logger.error(f"Error getting current weather: {e}")
            return f"Error getting weather information: {str(e)}"
    
    async def get_weather_forecast(self, parameters: Dict[str, Any]) -> str:
        """Get weather forecast for a location"""
        try:
            location = parameters.get('location')
            days = parameters.get('days', 5)
            units = parameters.get('units', 'metric')
            
            if not location:
                return "Error: Missing required parameter 'location'"
            
            if not self.api_key:
                return "Error: OpenWeatherMap API key not configured"
            
            # Limit days to reasonable range
            days = min(max(days, 1), 5)
            
            # Prepare API request
            params = {
                'q': location,
                'appid': self.api_key,
                'units': units,
                'cnt': days * 8  # 8 forecasts per day (3-hour intervals)
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/forecast",
                    params=params,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    city_info = data.get('city', {})
                    city_name = city_info.get('name', location)
                    country = city_info.get('country', '')
                    forecasts = data.get('list', [])
                    
                    if not forecasts:
                        return f"No forecast data available for {location}"
                    
                    # Format temperature unit
                    temp_unit = '°C' if units == 'metric' else '°F' if units == 'imperial' else 'K'
                    
                    result = f"🌦️ {days}-day weather forecast for {city_name}"
                    if country:
                        result += f", {country}"
                    result += ":\n\n"
                    
                    # Group forecasts by day and show daily summary
                    current_date = None
                    daily_temps = []
                    daily_conditions = []
                    
                    for forecast in forecasts:
                        dt_txt = forecast.get('dt_txt', '')
                        date = dt_txt.split(' ')[0] if dt_txt else ''
                        
                        if date != current_date:
                            # Output previous day's summary
                            if current_date and daily_temps:
                                min_temp = min(daily_temps)
                                max_temp = max(daily_temps)
                                common_condition = max(set(daily_conditions), key=daily_conditions.count)
                                result += f"**{current_date}:** {common_condition}, {min_temp}-{max_temp}{temp_unit}\n"
                            
                            # Reset for new day
                            current_date = date
                            daily_temps = []
                            daily_conditions = []
                        
                        # Collect data for the day
                        main = forecast.get('main', {})
                        weather = forecast.get('weather', [{}])[0]
                        
                        if main.get('temp'):
                            daily_temps.append(main['temp'])
                        if weather.get('description'):
                            daily_conditions.append(weather['description'].title())
                    
                    # Output last day's summary
                    if current_date and daily_temps:
                        min_temp = min(daily_temps)
                        max_temp = max(daily_temps)
                        common_condition = max(set(daily_conditions), key=daily_conditions.count)
                        result += f"**{current_date}:** {common_condition}, {min_temp}-{max_temp}{temp_unit}\n"
                    
                    return result
                    
                elif response.status_code == 404:
                    return f"Error: Location '{location}' not found"
                else:
                    logger.error(f"OpenWeatherMap API error: {response.status_code} - {response.text}")
                    return f"Error: Weather API returned status {response.status_code}"
                    
        except Exception as e:
            logger.error(f"Error getting weather forecast: {e}")
            return f"Error getting weather forecast: {str(e)}"

# Global instance
weather_tools = WeatherTools()