describe('Login Flow', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    it('should display login form', () => {
        cy.get('input[name="username"]').should('be.visible');
        cy.get('input[name="password"]').should('be.visible');
        cy.get('button[type="submit"]').should('be.visible');
    });

    it('should login successfully with valid credentials', () => {
        cy.get('input[name="username"]').type('admin');
        cy.get('input[name="password"]').type('admin123');
        cy.get('button[type="submit"]').click();

        // Should redirect to dashboard
        cy.location('pathname').should('eq', '/');

        // Should show dashboard content
        cy.contains('Dashboard').should('be.visible');
    });

    it('should show error with invalid credentials', () => {
        cy.get('input[name="username"]').type('wronguser');
        cy.get('input[name="password"]').type('wrongpass');
        cy.get('button[type="submit"]').click();

        // Should show error message
        cy.contains('Invalid credentials').should('be.visible');

        // Should stay on login page
        cy.location('pathname').should('eq', '/login');
    });

    it('should require username and password', () => {
        cy.get('button[type="submit"]').click();

        // HTML5 validation should prevent submission
        cy.get('input[name="username"]:invalid').should('exist');
    });

    it('should persist login across page reload', () => {
        cy.login('admin', 'admin123');

        cy.reload();

        // Should still be logged in
        cy.location('pathname').should('eq', '/');
    });
});
