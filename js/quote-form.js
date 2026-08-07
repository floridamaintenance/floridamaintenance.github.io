(function () {
  'use strict';

  var MIN_COMPLETION_TIME = 3000;
  var REQUEST_TIMEOUT = 20000;

  function upsertHiddenField(form, name, value) {
    var field = form.querySelector('input[name="' + name + '"]');
    if (!field) {
      field = document.createElement('input');
      field.type = 'hidden';
      field.name = name;
      form.appendChild(field);
    }
    field.value = value;
    return field;
  }

  function getStatusElement(form, submitButton) {
    var status = form.querySelector('[data-form-status]');
    if (!status) {
      status = document.createElement('p');
      status.className = 'form-status';
      status.setAttribute('data-form-status', '');
      if (submitButton) submitButton.insertAdjacentElement('afterend', status);
      else form.appendChild(status);
    }
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.tabIndex = -1;
    return status;
  }

  function setStatus(status, message, state, shouldFocus) {
    status.replaceChildren(document.createTextNode(message || ''));
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
    status.setAttribute('role', state === 'error' ? 'alert' : 'status');
    if (shouldFocus) status.focus({ preventScroll: true });
  }

  function showFallback(status, message) {
    status.replaceChildren();
    status.dataset.state = 'error';
    status.setAttribute('role', 'alert');
    status.appendChild(document.createTextNode(message + ' Please call '));

    var phone = document.createElement('a');
    phone.href = 'tel:+13059005464';
    phone.textContent = '(305) 900-5464';
    status.appendChild(phone);
    status.appendChild(document.createTextNode(' or email '));

    var email = document.createElement('a');
    email.href = 'mailto:info@floridamaintenance.com';
    email.textContent = 'info@floridamaintenance.com';
    status.appendChild(email);
    status.appendChild(document.createTextNode('.'));
    status.focus({ preventScroll: true });
  }

  function setSubmitting(form, button, submitting) {
    form.dataset.submitting = submitting ? 'true' : 'false';
    form.classList.toggle('is-loading', submitting);
    form.setAttribute('aria-busy', submitting ? 'true' : 'false');

    if (!button) return;
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.tagName === 'INPUT' ? button.value : button.textContent.trim();
    }
    button.disabled = submitting;
    button.setAttribute('aria-disabled', submitting ? 'true' : 'false');
    button.classList.toggle('is-loading', submitting);
    if (button.tagName === 'INPUT') {
      button.value = submitting ? 'Sending…' : button.dataset.originalLabel;
    } else {
      button.textContent = submitting ? 'Sending…' : button.dataset.originalLabel;
    }
  }

  function responseMessage(payload) {
    if (!payload || !Array.isArray(payload.errors)) return '';
    return payload.errors
      .map(function (error) { return error && error.message ? String(error.message) : ''; })
      .filter(Boolean)
      .join(' ');
  }

  function safeAnalyticsValue(value, fallback) {
    var clean = typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').trim() : '';
    return (clean || fallback).slice(0, 100);
  }

  function getService(form) {
    var field = form.elements.namedItem('service') || form.elements.namedItem('requested_service');
    if (!field) return 'Not specified';
    var value = safeAnalyticsValue(field.value, 'Not specified');
    var allowedServices = [
      'Pressure Cleaning',
      'Power Sweeping',
      'Power Scrubbing',
      'Soft Washing',
      'Not Sure / Multiple Services'
    ];
    return allowedServices.indexOf(value) === -1 ? 'Not specified' : value;
  }

  function trackAcceptedRequest(form) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'quote_form_success',
      form_name: 'quote_request',
      service: getService(form),
      source_page: safeAnalyticsValue(window.location.pathname, '/')
    });
  }

  function initQuoteForm(form) {
    if (form.dataset.quoteFormReady === 'true') return;
    form.dataset.quoteFormReady = 'true';

    var startedAt = Date.now();
    var submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    var status = getStatusElement(form, submitButton);
    var honeypot = form.querySelector('input[name="_gotcha"]');

    form.addEventListener('focusin', function () {
      document.body.classList.add('quote-form-active');
    });
    form.addEventListener('focusout', function () {
      window.setTimeout(function () {
        if (!form.contains(document.activeElement)) {
          document.body.classList.remove('quote-form-active');
        }
      }, 0);
    });

    upsertHiddenField(form, 'source_page', window.location.pathname);
    upsertHiddenField(form, 'form_started_at', String(startedAt));

    if (!window.fetch || !window.FormData || !window.Promise) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (form.dataset.submitting === 'true') return;

      if (!form.checkValidity()) {
        setStatus(status, 'Please complete the highlighted fields before sending your request.', 'error', false);
        form.reportValidity();
        return;
      }

      if (honeypot && honeypot.value.trim()) {
        setStatus(status, 'We could not verify this request. Please refresh the page and try again.', 'error', true);
        return;
      }

      if (Date.now() - startedAt < MIN_COMPLETION_TIME) {
        setStatus(status, 'Please take a moment to review your information, then try again.', 'error', true);
        return;
      }

      upsertHiddenField(form, 'source_page', window.location.pathname);
      setSubmitting(form, submitButton, true);
      setStatus(status, 'Sending your request…', 'pending', false);

      var controller = window.AbortController ? new AbortController() : null;
      var timeout = controller ? window.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT) : null;
      var options = {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      };
      if (controller) options.signal = controller.signal;

      fetch(form.action, options)
        .then(function (response) {
          return response.json()
            .catch(function () { return null; })
            .then(function (payload) {
              if (!response.ok || !payload || typeof payload !== 'object' || payload.ok === false) {
                var error = new Error(responseMessage(payload) || 'The form service did not accept the request.');
                error.isFormResponse = true;
                throw error;
              }
              return payload;
            });
        })
        .then(function () {
          if (timeout) window.clearTimeout(timeout);
          setStatus(status, 'Your request was sent. Taking you to the confirmation page…', 'success', false);
          trackAcceptedRequest(form);

          var successUrl = form.dataset.successUrl || 'thanks.html';
          window.setTimeout(function () {
            window.location.assign(successUrl);
          }, 150);
        })
        .catch(function (error) {
          if (timeout) window.clearTimeout(timeout);
          setSubmitting(form, submitButton, false);
          if (error && error.isFormResponse && error.message) {
            showFallback(status, error.message);
          } else if (error && error.name === 'AbortError') {
            showFallback(status, 'The request took too long to send.');
          } else {
            showFallback(status, 'We could not send your request right now.');
          }
        });
    });
  }

  function init() {
    document.querySelectorAll('form[data-quote-form]').forEach(initQuoteForm);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

