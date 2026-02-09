describe('Dashboard Navigation', () => {
    beforeEach(() => {
        cy.login('admin', 'admin123');
    });

    it('should display dashboard after login', () => {
        cy.url().should('include', '/dashboard');
        cy.contains('Dashboard').should('be.visible');
    });

    it('should navigate to Classes page', () => {
        cy.contains('Kelas').click();
        cy.url().should('include', '/classes');
        cy.contains('Manajemen Kelas').should('be.visible');
    });

    it('should navigate to Scan page', () => {
        cy.contains('Scan').click();
        cy.url().should('include', '/scan');
        cy.contains('Scan QR Presensi').should('be.visible');
    });

    it('should navigate to Schedule page', () => {
        cy.contains('Jadwal').click();
        cy.url().should('include', '/schedule');
        cy.contains('Jadwal Kelas').should('be.visible');
    });

    it('should navigate to Reports page', () => {
        cy.contains('Laporan').click();
        cy.url().should('include', '/reports');
        cy.contains('Laporan Presensi').should('be.visible');
    });

    it('should navigate to Settings page', () => {
        cy.contains('Pengaturan').click();
        cy.url().should('include', '/settings');
        cy.contains('Pengaturan Sistem').should('be.visible');
    });

    it('should show active navigation item', () => {
        cy.contains('Kelas').click();

        // Active item should have special styling
        cy.contains('Kelas').parent().should('have.class', 'bg-primary');
    });

    it('should display user info in sidebar', () => {
        cy.contains('admin').should('be.visible');
    });
});
