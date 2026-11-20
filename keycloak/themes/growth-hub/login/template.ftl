<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in</title>
    <link rel="icon" href="${url.resourcesPath}/img/favicon.ico?v=gh" />
    <link href="${url.resourcesPath}/css/login.css" rel="stylesheet" />
</head>
<body>
<div class="page">
    <div class="art" aria-hidden="true"></div>
    <main class="panel">
        <div class="panel-inner">
            <img class="logo" src="${url.resourcesPath}/img/logo.png?v=gh" alt="Growth Hub" />
            <#if auth?has_content && auth.showUsername() && !auth.showResetCredentials()>
                <#nested "show-username">
                <div id="kc-username">
                    <span>${auth.attemptedUsername}</span>
                    <a href="${url.loginRestartFlowUrl}">${msg("restartLoginTooltip")}</a>
                </div>
            </#if>

            <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                <div class="alert alert-${message.type}">${kcSanitize(message.summary)?no_esc}</div>
            </#if>

            <#nested "form">

            <#if auth?has_content && auth.showTryAnotherWayLink()>
                <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post">
                    <input type="hidden" name="tryAnotherWay" value="on"/>
                    <a href="#" onclick="document.forms['kc-select-try-another-way-form'].requestSubmit();return false;">${msg("doTryAnotherWay")}</a>
                </form>
            </#if>

            <#nested "socialProviders">

            <#if displayInfo>
                <div id="kc-info">
                    <#nested "info">
                </div>
            </#if>
        </div>
    </main>
</div>
</body>
</html>
</#macro>
