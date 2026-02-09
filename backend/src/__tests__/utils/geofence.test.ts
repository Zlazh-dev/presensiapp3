import { calculateDistance, isWithinGeofence } from '../../utils/geofence';

describe('Geofencing Utilities', () => {
    describe('calculateDistance', () => {
        it('should calculate distance between two points correctly', () => {
            // Jakarta City Center to Monas (approx 1.5km)
            const distance = calculateDistance(
                -6.2088, 106.8456, // Point A
                -6.1751, 106.8650  // Point B (Monas)
            );

            // Distance should be approximately 4.5km
            expect(distance).toBeGreaterThan(4000);
            expect(distance).toBeLessThan(5000);
        });

        it('should return 0 for same coordinates', () => {
            const distance = calculateDistance(
                -6.2088, 106.8456,
                -6.2088, 106.8456
            );

            expect(distance).toBeLessThan(1); // Should be very close to 0
        });

        it('should calculate short distances accurately', () => {
            // Two points ~50 meters apart
            const distance = calculateDistance(
                -6.2088, 106.8456,
                -6.2092, 106.8456
            );

            expect(distance).toBeGreaterThan(40);
            expect(distance).toBeLessThan(60);
        });
    });

    describe('isWithinGeofence', () => {
        const centerLat = -6.2088;
        const centerLon = 106.8456;

        it('should return true when within geofence radius', () => {
            const userLat = -6.2089; // Very close
            const userLon = 106.8457;
            const radius = 100; // 100 meters

            const result = isWithinGeofence(userLat, userLon, centerLat, centerLon, radius);
            expect(result).toBe(true);
        });

        it('should return false when outside geofence radius', () => {
            const userLat = -6.2100; // ~150 meters away
            const userLon = 106.8470;
            const radius = 100; // 100 meters

            const result = isWithinGeofence(userLat, userLon, centerLat, centerLon, radius);
            expect(result).toBe(false);
        });

        it('should return true when exactly at boundary', () => {
            // Calculate a point exactly 100 meters away
            const distance = calculateDistance(centerLat, centerLon, -6.2097, 106.8456);
            const radius = Math.ceil(distance); // Use actual calculated distance as radius

            const result = isWithinGeofence(-6.2097, 106.8456, centerLat, centerLon, radius);
            expect(result).toBe(true); // Should be within or at boundary
        });

        it('should work with large radius', () => {
            const userLat = -6.2200; // ~1.2km away
            const userLon = 106.8456;
            const radius = 2000; // 2km

            const result = isWithinGeofence(userLat, userLon, centerLat, centerLon, radius);
            expect(result).toBe(true);
        });

        it('should work with small radius', () => {
            const userLat = -6.2089; // ~10 meters away
            const userLon = 106.8456;
            const radius = 5; // 5 meters

            const result = isWithinGeofence(userLat, userLon, centerLat, centerLon, radius);
            expect(result).toBe(false);
        });
    });
});
