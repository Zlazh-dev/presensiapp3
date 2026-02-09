describe('QR Code Generation and Scanning', () => {
    beforeEach(() => {
        cy.login('admin', 'admin123');
    });

    describe('QR Code Generation', () => {
        it('should generate QR code for class', () => {
            cy.visit('/classes');

            // Click QR Code button on first class
            cy.contains('QR Code').first().click();

            // Modal should open with QR code
            cy.get('[role="dialog"]').should('be.visible');
            cy.get('svg').should('be.visible'); // QR code SVG

            // Should show class name
            cy.contains('Kelas').should('be.visible');
        });

        it('should allow downloading QR code', () => {
            cy.visit('/classes');
            cy.contains('QR Code').first().click();

            // Download button should be visible
            cy.contains('Download').should('be.visible');
        });

        it('should allow printing QR code', () => {
            cy.visit('/classes');
            cy.contains('QR Code').first().click();

            // Print button should be visible
            cy.contains('Print').should('be.visible');
        });

        it('should generate QR code for teacher room', () => {
            cy.visit('/classes');

            // Click teacher room QR button
            cy.contains('QR Ruang Guru').click();

            // Modal should open
            cy.get('[role="dialog"]').should('be.visible');
            cy.contains('Ruang Guru').should('be.visible');
        });

        it('should close QR modal', () => {
            cy.visit('/classes');
            cy.contains('QR Code').first().click();

            // Close modal
            cy.get('[role="dialog"]').within(() => {
                cy.get('button').contains('×').click();
            });

            // Modal should be closed
            cy.get('[role="dialog"]').should('not.exist');
        });
    });

    describe('QR Code Scanning', () => {
        beforeEach(() => {
            cy.mockGeolocation(-6.2088, 106.8456);
            cy.visit('/scan');
        });

        it('should show scanner interface', () => {
            // Scanner should be visible after location is granted
            cy.get('#reader').should('be.visible');
        });

        it('should show instructions', () => {
            cy.contains('Instruksi').should('be.visible');
            cy.contains('Arahkan kamera ke QR Code').should('be.visible');
        });

        it('should show geofencing requirement', () => {
            cy.contains('Persyaratan Geofencing').should('be.visible');
            cy.contains('100 meter').should('be.visible');
        });

        // Note: Actual QR scanning requires camera access
        // which is difficult to test in Cypress
        // We would need to mock the html5-qrcode library
    });
});
