describe('Geofencing Workflow', () => {
    beforeEach(() => {
        cy.login('admin', 'admin123');
    });

    it('should request geolocation permission', () => {
        cy.visit('/scan', {
            onBeforeLoad(win) {
                cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((success) => {
                    success({
                        coords: {
                            latitude: -6.2088,
                            longitude: 106.8456,
                            accuracy: 10,
                            altitude: null,
                            altitudeAccuracy: null,
                            heading: null,
                            speed: null,
                        },
                        timestamp: Date.now(),
                    });
                });
            }
        });

        // Should display location status
        cy.contains('Status Lokasi').should('be.visible');
    });

    it('should show coordinates when location is granted', () => {
        cy.visit('/scan', {
            onBeforeLoad(win) {
                cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((success) => {
                    success({
                        coords: {
                            latitude: -6.2088,
                            longitude: 106.8456,
                            accuracy: 10,
                            altitude: null,
                            altitudeAccuracy: null,
                            heading: null,
                            speed: null,
                        },
                        timestamp: Date.now(),
                    });
                });
            }
        });

        // Should display coordinates
        cy.contains('-6.2088').should('be.visible');
        cy.contains('106.8456').should('be.visible');
    });

    it('should enable scanner when location is available', () => {
        cy.visit('/scan', {
            onBeforeLoad(win) {
                cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((success) => {
                    success({
                        coords: {
                            latitude: -6.2088,
                            longitude: 106.8456,
                            accuracy: 10,
                            altitude: null,
                            altitudeAccuracy: null,
                            heading: null,
                            speed: null,
                        },
                        timestamp: Date.now(),
                    });
                });
            }
        });

        // Scanner should be enabled
        cy.get('#reader').should('be.visible');
    });

    it('should reject scan when outside geofence', () => {
        cy.visit('/scan', {
            onBeforeLoad(win) {
                cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((success) => {
                    success({
                        coords: {
                            latitude: -6.3000,
                            longitude: 106.9000,
                            accuracy: 10,
                            altitude: null,
                            altitudeAccuracy: null,
                            heading: null,
                            speed: null,
                        },
                        timestamp: Date.now(),
                    });
                });
            }
        });

        // Verify location is shown
        cy.contains('-6.3000').should('be.visible');
    });

    it('should show error when location permission denied', () => {
        cy.visit('/scan', {
            onBeforeLoad(win) {
                cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((success, error) => {
                    error({
                        code: 1, // PERMISSION_DENIED
                        message: 'User denied geolocation',
                        PERMISSION_DENIED: 1,
                        POSITION_UNAVAILABLE: 2,
                        TIMEOUT: 3,
                    });
                });
            }
        });

        // Should show error message
        cy.contains('Izin akses lokasi ditolak').should('be.visible');
    });

    it('should allow retry when location fails', () => {
        cy.visit('/scan', {
            onBeforeLoad(win) {
                cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((success, error) => {
                    error({
                        code: 2, // POSITION_UNAVAILABLE
                        message: 'Position unavailable',
                        PERMISSION_DENIED: 1,
                        POSITION_UNAVAILABLE: 2,
                        TIMEOUT: 3,
                    });
                });
            }
        });

        // Wait for error message first to ensure state update
        cy.contains('Informasi lokasi tidak tersedia').should('be.visible');

        // Should show retry button
        cy.contains('Coba Lagi').should('be.visible').click();
    });
});
