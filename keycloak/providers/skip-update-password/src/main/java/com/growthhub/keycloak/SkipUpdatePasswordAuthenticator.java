package com.growthhub.keycloak;

import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.Authenticator;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;

/** Drops the update-password step after Microsoft has already accepted the account. */
public class SkipUpdatePasswordAuthenticator implements Authenticator {
    @Override
    public void authenticate(AuthenticationFlowContext context) {
        UserModel user = context.getUser();
        if (user != null) {
            user.removeRequiredAction(UserModel.RequiredAction.UPDATE_PASSWORD.name());
        }
        context.getAuthenticationSession().removeRequiredAction(UserModel.RequiredAction.UPDATE_PASSWORD.name());
        context.success();
    }

    @Override
    public void action(AuthenticationFlowContext context) {
        context.success();
    }

    @Override
    public boolean requiresUser() {
        return false;
    }

    @Override
    public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) {
        return true;
    }

    @Override
    public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {
    }

    @Override
    public void close() {
    }
}
