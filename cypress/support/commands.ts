/// <reference types="cypress" />

// ***********************************************
// Custom Cypress commands
// ***********************************************

declare global {
    namespace Cypress {
        interface Chainable {
            /**
             * Custom command to login
             * @example cy.login('admin', 'admin123')
             */
            login(username: string, password: string): Chainable<void>;

            /**
             * Custom command to get auth token
             * @example cy.getAuthToken('admin', 'admin123').then((token) => {...})
             */
            getAuthToken(username: string, password: string): Chainable<string>;

            /**
             * Custom command to mock geolocation
             * @example cy.mockGeolocation(-6.2088, 106.8456)
             */
            mockGeolocation(latitude: number, longitude: number): Chainable<void>;
        }
    }
}

Cypress.Commands.add('login', (username: string, password: string) => {
    cy.visit('/');
    cy.get('input[name="username"]').type(username);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();

    // Wait for redirect or dashboard to load
    cy.url().should('not.include', '/login');
});

Cypress.Commands.add('getAuthToken', (username: string, password: string) => {
    return cy
        .request({
            method: 'POST',
            url: `${Cypress.env('apiUrl')}/api/auth/login`,
            body: {
                username,
                password,
            },
        })
        .then((response) => {
            expect(response.status).to.eq(200);
            return response.body.token;
        });
});

Cypress.Commands.add('mockGeolocation', (latitude: number, longitude: number) => {
    cy.window().then((win) => {
        cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((success) => {
            success({
                coords: {
                    latitude,
                    longitude,
                    accuracy: 10,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null,
                },
                timestamp: Date.now(),
            });
        });
    });
});

export { };
