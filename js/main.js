/* ==========================================================================
   DIAMBA SAGRADA — Main JavaScript
   Handles: navigation, scroll animations, accordion, multi-step form,
            page-load animations, intersection observer reveals,
            blog filters, contact form validation, back-to-top, cookie consent,
            product modal, tooltips, WhatsApp float, drag-and-drop upload.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     0. WEBHOOK — Padrão único de envio JSON para n8n
     ------------------------------------------------------------------------ */
  var WEBHOOK_URL = 'https://aios-n8n-webhook.yspmhc.easypanel.host/webhook/diamba-sagrada';

  /* ------------------------------------------------------------------------
     0.1 CONFIG — valores definidos na reunião (28/05)
     ⚠ PENDENTE: preencher com os dados reais antes de publicar.
     ------------------------------------------------------------------------ */
  var WHATSAPP = '5500000000000';                       // número novo (só dígitos, DDI 55)
  var CONTACT_EMAIL = 'contato@diambasagrada.org.br';   // e-mail corporativo
  var PIX_KEY = '';                                     // chave Pix para doações
  var PAYMENT_URL = '';                                 // link Abacate Pay da taxa de associação
  var VOUCHER_PERCENT = 50;                             // desconto da 1ª consulta

  function whatsappUrl(message) {
    var base = 'https://wa.me/' + WHATSAPP;
    return message ? base + '?text=' + encodeURIComponent(message) : base;
  }

  function gerarVoucher() {
    var alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var b = '';
    for (var i = 0; i < 6; i++) {
      b += alpha.charAt(Math.floor(Math.random() * alpha.length));
    }
    return 'DS-' + b.slice(0, 3) + '-' + b.slice(3);
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = reader.result || '';
        var base64 = String(result).split(',')[1] || '';
        resolve({ name: file.name, type: file.type, size: file.size, data: base64 });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function collectFormData(form) {
    var data = {};
    var filePromises = [];

    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      var name = el.name;

      if (el.type === 'checkbox') {
        data[name] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) data[name] = el.value;
      } else if (el.type === 'file') {
        if (el.files && el.files.length > 0) {
          (function (key, file) {
            filePromises.push(
              fileToBase64(file).then(function (payload) { data[key] = payload; })
            );
          })(name, el.files[0]);
        } else {
          data[name] = null;
        }
      } else if (el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        data[name] = el.value;
      }
    });

    return Promise.all(filePromises).then(function () { return data; });
  }

  function submitFormToWebhook(form) {
    var formId = form.id || 'unknown-form';
    var pageSlug = (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';

    return collectFormData(form).then(function (data) {
      var payload = {
        form: formId,
        page: pageSlug,
        url: window.location.href,
        submittedAt: new Date().toISOString(),
        data: data
      };

      return fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error('Webhook respondeu ' + res.status);
        return res;
      });
    });
  }

  /* ------------------------------------------------------------------------
     1. NAVIGATION — Scroll-based background + Mobile menu
     ------------------------------------------------------------------------ */
  var nav = document.querySelector('.nav');
  var navToggle = document.querySelector('.nav__toggle');
  var navMobile = document.querySelector('.nav__mobile');

  function handleNavScroll() {
    if (!nav) return;
    if (window.scrollY > 60) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
  }

  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  if (navToggle && navMobile) {
    navToggle.addEventListener('click', function () {
      var isOpen = navMobile.classList.contains('nav__mobile--open');
      navMobile.classList.toggle('nav__mobile--open');
      navToggle.setAttribute('aria-expanded', String(!isOpen));
      document.body.style.overflow = isOpen ? '' : 'hidden';
    });

    navMobile.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navMobile.classList.remove('nav__mobile--open');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* ------------------------------------------------------------------------
     2. SCROLL REVEAL — IntersectionObserver for .reveal elements
     ------------------------------------------------------------------------ */
  function initScrollReveal() {
    var reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      reveals.forEach(function (el) {
        el.classList.add('reveal--visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal--visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    reveals.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ------------------------------------------------------------------------
     3. PAGE-LOAD ANIMATION — Staggered fade-in on hero elements
     ------------------------------------------------------------------------ */
  function initPageLoad() {
    var elements = document.querySelectorAll('.page-enter');
    if (!elements.length) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        elements.forEach(function (el) {
          el.classList.add('page-enter--visible');
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     4. SMOOTH SCROLL — For anchor links
     ------------------------------------------------------------------------ */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var targetId = this.getAttribute('href');
        if (targetId === '#') return;

        var target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          var offset = nav ? nav.offsetHeight : 0;
          var top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     5. ACCORDION — FAQ expand/collapse
     ------------------------------------------------------------------------ */
  function initAccordion() {
    var items = document.querySelectorAll('.accordion__item');
    if (!items.length) return;

    items.forEach(function (item) {
      var trigger = item.querySelector('.accordion__trigger');
      var content = item.querySelector('.accordion__content');
      if (!trigger || !content) return;

      trigger.addEventListener('click', function () {
        var isOpen = item.classList.contains('accordion__item--open');

        // Close siblings within same accordion container
        var parent = item.closest('.accordion');
        if (parent) {
          parent.querySelectorAll('.accordion__item').forEach(function (otherItem) {
            if (otherItem !== item) {
              otherItem.classList.remove('accordion__item--open');
              var otherContent = otherItem.querySelector('.accordion__content');
              if (otherContent) otherContent.style.maxHeight = '0';
              var otherTrigger = otherItem.querySelector('.accordion__trigger');
              if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
            }
          });
        }

        if (isOpen) {
          item.classList.remove('accordion__item--open');
          content.style.maxHeight = '0';
          trigger.setAttribute('aria-expanded', 'false');
        } else {
          item.classList.add('accordion__item--open');
          content.style.maxHeight = content.scrollHeight + 'px';
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     6. MULTI-STEP FORM — Membership form with validation
     ------------------------------------------------------------------------ */
  function initMultiStepForm() {
    var form = document.getElementById('membership-form');
    if (!form) return;

    var steps = form.querySelectorAll('.form-step');
    var stepperSteps = document.querySelectorAll('.stepper__step');
    var progressBar = document.querySelector('.stepper__progress');
    var currentStep = 0;

    updateStep(0);

    form.querySelectorAll('[data-action="next"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (validateStep(currentStep)) {
          goToStep(currentStep + 1);
        }
      });
    });

    form.querySelectorAll('[data-action="prev"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        goToStep(currentStep - 1);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateStep(currentStep)) return;

      var submitBtn = form.querySelector('button[type="submit"]');
      var originalText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
      }

      // Gera o voucher (se solicitado) e injeta no payload enviado ao webhook.
      var querVoucher = form.querySelector('input[name="quer_voucher"]');
      var voucher = (!querVoucher || querVoucher.checked) ? gerarVoucher() : '';
      var voucherInput = form.querySelector('input[name="voucher"]');
      if (voucherInput) voucherInput.value = voucher;

      submitFormToWebhook(form)
        .then(function () {
          populateSuccessStep(voucher);
          goToStep(steps.length - 1);
        })
        .catch(function (err) {
          console.error('Erro ao enviar cadastro:', err);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText || 'Tentar novamente';
          }
          alert('Não foi possível enviar seu cadastro agora. Tente novamente em instantes.');
        });
    });

    function populateSuccessStep(voucher) {
      var wrap = form.querySelector('[data-voucher-wrap]');
      var disp = form.querySelector('[data-voucher-display]');
      if (voucher && wrap && disp) {
        disp.textContent = voucher;
        wrap.hidden = false;
      }

      var payBtn = form.querySelector('[data-payment-btn]');
      var payNote = form.querySelector('[data-payment-note]');
      if (payBtn) {
        if (PAYMENT_URL) {
          payBtn.href = PAYMENT_URL;
          payBtn.hidden = false;
          if (payNote) payNote.hidden = true;
        } else {
          payBtn.hidden = true;
          if (payNote) payNote.hidden = false;
        }
      }

      var waBtn = form.querySelector('[data-whatsapp-btn]');
      if (waBtn) {
        var msg = 'Olá! Acabei de me associar à Diamba Sagrada.' +
          (voucher ? ' Meu voucher é ' + voucher + '.' : '') +
          ' Podem me passar os próximos passos?';
        waBtn.href = whatsappUrl(msg);
      }
    }

    function goToStep(index) {
      if (index < 0 || index >= steps.length) return;
      steps[currentStep].classList.add('form-step--exit-left');
      steps[currentStep].classList.remove('form-step--active');
      currentStep = index;
      updateStep(currentStep);
    }

    function updateStep(index) {
      steps.forEach(function (step, i) {
        step.classList.remove('form-step--active', 'form-step--exit-left');
        if (i === index) step.classList.add('form-step--active');
      });

      stepperSteps.forEach(function (step, i) {
        step.classList.remove('stepper__step--active', 'stepper__step--done');
        if (i < index) step.classList.add('stepper__step--done');
        else if (i === index) step.classList.add('stepper__step--active');
      });

      if (progressBar) {
        var progress = (index / (steps.length - 1)) * 100;
        progressBar.style.width = progress + '%';
      }

      var formTop = form.getBoundingClientRect().top + window.scrollY - 120;
      if (index > 0) {
        window.scrollTo({ top: formTop, behavior: 'smooth' });
      }
    }

    function validateStep(stepIndex) {
      var step = steps[stepIndex];
      var inputs = step.querySelectorAll('[required]');
      var valid = true;

      inputs.forEach(function (input) {
        var errorEl = input.parentElement.querySelector('.form-error');
        if (!input.value.trim()) {
          valid = false;
          input.classList.add('form-input--error');
          if (errorEl) errorEl.classList.add('form-error--visible');
        } else {
          input.classList.remove('form-input--error');
          if (errorEl) errorEl.classList.remove('form-error--visible');
        }

        if (input.type === 'email' && input.value.trim()) {
          var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(input.value.trim())) {
            valid = false;
            input.classList.add('form-input--error');
            if (errorEl) {
              errorEl.textContent = 'Insira um e-mail válido.';
              errorEl.classList.add('form-error--visible');
            }
          }
        }
      });

      var checkbox = step.querySelector('input[type="checkbox"][required]');
      if (checkbox && !checkbox.checked) {
        valid = false;
        var checkError = step.querySelector('.form-error');
        if (checkError) checkError.classList.add('form-error--visible');
      }

      return valid;
    }

    form.querySelectorAll('.form-input').forEach(function (input) {
      input.addEventListener('input', function () {
        this.classList.remove('form-input--error');
        var errorEl = this.parentElement.querySelector('.form-error');
        if (errorEl) errorEl.classList.remove('form-error--visible');
      });
    });
  }

  /* ------------------------------------------------------------------------
     7. FILE UPLOAD — Visual feedback + drag-and-drop
     ------------------------------------------------------------------------ */
  function initFileUpload() {
    var uploads = document.querySelectorAll('.file-upload');
    uploads.forEach(function (upload) {
      var input = upload.querySelector('input[type="file"]');
      var textEl = upload.querySelector('.file-upload__text');

      if (!input || !textEl) return;

      upload.addEventListener('click', function () {
        input.click();
      });

      upload.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          input.click();
        }
      });

      input.addEventListener('change', function () {
        if (input.files.length > 0) {
          textEl.innerHTML = '<strong>' + input.files[0].name + '</strong> selecionado';
          upload.style.borderColor = 'var(--color-green-deep)';
        }
      });

      // Drag and drop
      ['dragenter', 'dragover'].forEach(function (event) {
        upload.addEventListener(event, function (e) {
          e.preventDefault();
          e.stopPropagation();
          upload.classList.add('file-upload--drag-active');
        });
      });

      ['dragleave', 'drop'].forEach(function (event) {
        upload.addEventListener(event, function (e) {
          e.preventDefault();
          e.stopPropagation();
          upload.classList.remove('file-upload--drag-active');
        });
      });

      upload.addEventListener('drop', function (e) {
        var files = e.dataTransfer.files;
        if (files.length > 0) {
          input.files = files;
          textEl.innerHTML = '<strong>' + files[0].name + '</strong> selecionado';
          upload.style.borderColor = 'var(--color-green-deep)';
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     8. BACK TO TOP BUTTON
     ------------------------------------------------------------------------ */
  function initBackToTop() {
    var btn = document.querySelector('.back-to-top');
    if (!btn) return;

    function toggleVisibility() {
      if (window.scrollY > 400) {
        btn.classList.add('back-to-top--visible');
      } else {
        btn.classList.remove('back-to-top--visible');
      }
    }

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility();

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ------------------------------------------------------------------------
     9. COOKIE CONSENT BANNER
     ------------------------------------------------------------------------ */
  function initCookieConsent() {
    var banner = document.querySelector('.cookie-consent');
    if (!banner) return;

    // Check if already accepted
    if (localStorage.getItem('ds-cookies-accepted')) return;

    // Show after a brief delay
    setTimeout(function () {
      banner.classList.add('cookie-consent--visible');
    }, 1500);

    var acceptBtn = banner.querySelector('.cookie-consent__btn--accept');
    var customizeBtn = banner.querySelector('.cookie-consent__btn--customize');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        localStorage.setItem('ds-cookies-accepted', 'true');
        banner.classList.remove('cookie-consent--visible');
      });
    }

    if (customizeBtn) {
      customizeBtn.addEventListener('click', function () {
        localStorage.setItem('ds-cookies-accepted', 'custom');
        banner.classList.remove('cookie-consent--visible');
      });
    }
  }

  /* ------------------------------------------------------------------------
     10. BLOG FILTERS — Category filtering with animation
     ------------------------------------------------------------------------ */
  function initBlogFilters() {
    var filters = document.querySelectorAll('.blog-filter');
    var cards = document.querySelectorAll('.blog-card[data-category]');
    if (!filters.length || !cards.length) return;

    filters.forEach(function (filter) {
      filter.addEventListener('click', function () {
        var category = this.getAttribute('data-filter');

        // Update active filter
        filters.forEach(function (f) { f.classList.remove('blog-filter--active'); });
        this.classList.add('blog-filter--active');

        // Filter cards with animation
        cards.forEach(function (card) {
          var cardCategory = card.getAttribute('data-category');
          if (category === 'todos' || cardCategory === category) {
            card.style.display = '';
            // Trigger reflow then animate in
            requestAnimationFrame(function () {
              card.classList.remove('blog-card--hidden');
            });
          } else {
            card.classList.add('blog-card--hidden');
            // After animation, hide
            setTimeout(function () {
              if (card.classList.contains('blog-card--hidden')) {
                card.style.display = 'none';
              }
            }, 400);
          }
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     11. CONTACT FORM — Real-time validation with visual feedback
     ------------------------------------------------------------------------ */
  function initContactForm() {
    var form = document.getElementById('contact-form');
    if (!form) return;

    var inputs = form.querySelectorAll('.form-input[data-validate]');

    // Real-time validation
    inputs.forEach(function (input) {
      input.addEventListener('blur', function () {
        validateField(this);
      });

      input.addEventListener('input', function () {
        // Clear error state on typing
        this.classList.remove('form-input--invalid', 'form-input--shake');
        var feedback = this.parentElement.querySelector('.form-feedback');
        if (feedback) feedback.classList.remove('form-feedback--visible');
      });
    });

    // Form submission
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var allValid = true;

      inputs.forEach(function (input) {
        if (!validateField(input)) {
          allValid = false;
        }
      });

      // Check LGPD checkbox
      var lgpdCheck = form.querySelector('#lgpd-consent');
      if (lgpdCheck && !lgpdCheck.checked) {
        allValid = false;
        var errorEl = lgpdCheck.closest('.form-group').querySelector('.form-feedback');
        if (errorEl) {
          errorEl.classList.add('form-feedback--visible', 'form-feedback--error');
          errorEl.querySelector('span').textContent = 'Você precisa aceitar a política de privacidade.';
        }
      }

      if (allValid) {
        var submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) {
          submitBtn.textContent = 'Enviando...';
          submitBtn.disabled = true;
        }

        submitFormToWebhook(form)
          .then(function () {
            if (submitBtn) {
              submitBtn.textContent = 'Mensagem enviada!';
              submitBtn.classList.remove('btn--primary');
              submitBtn.classList.add('btn--gold');
            }
            setTimeout(function () {
              form.reset();
              if (submitBtn) {
                submitBtn.textContent = 'Enviar mensagem';
                submitBtn.classList.add('btn--primary');
                submitBtn.classList.remove('btn--gold');
                submitBtn.disabled = false;
              }
              inputs.forEach(function (input) {
                input.classList.remove('form-input--valid', 'form-input--invalid');
                var fb = input.parentElement.querySelector('.form-feedback');
                if (fb) fb.classList.remove('form-feedback--visible');
              });
            }, 3000);
          })
          .catch(function (err) {
            console.error('Erro ao enviar formulário:', err);
            if (submitBtn) {
              submitBtn.textContent = 'Erro — tente novamente';
              submitBtn.disabled = false;
            }
          });
      } else {
        // Shake the first invalid field
        var firstInvalid = form.querySelector('.form-input--invalid');
        if (firstInvalid) {
          firstInvalid.classList.add('form-input--shake');
          firstInvalid.focus();
          setTimeout(function () {
            firstInvalid.classList.remove('form-input--shake');
          }, 500);
        }
      }
    });

    function validateField(input) {
      var type = input.getAttribute('data-validate');
      var value = input.value.trim();
      var feedback = input.parentElement.querySelector('.form-feedback');
      var feedbackText = feedback ? feedback.querySelector('span') : null;
      var isValid = true;

      if (input.hasAttribute('required') && !value) {
        isValid = false;
        if (feedbackText) feedbackText.textContent = 'Este campo é obrigatório.';
      } else if (type === 'email' && value) {
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          isValid = false;
          if (feedbackText) feedbackText.textContent = 'Insira um e-mail válido.';
        }
      } else if (type === 'name' && value && value.length < 2) {
        isValid = false;
        if (feedbackText) feedbackText.textContent = 'Nome muito curto.';
      }

      // Update visual state
      input.classList.remove('form-input--valid', 'form-input--invalid');
      if (feedback) {
        feedback.classList.remove('form-feedback--visible', 'form-feedback--success', 'form-feedback--error');
      }

      if (!value && !input.hasAttribute('required')) {
        // Empty optional field — no feedback
        return true;
      }

      if (isValid && value) {
        input.classList.add('form-input--valid');
        if (feedback) {
          feedback.classList.add('form-feedback--visible', 'form-feedback--success');
          if (feedbackText) feedbackText.textContent = 'Parece bom!';
        }
      } else if (!isValid) {
        input.classList.add('form-input--invalid');
        if (feedback) {
          feedback.classList.add('form-feedback--visible', 'form-feedback--error');
        }
      }

      return isValid;
    }
  }

  /* ------------------------------------------------------------------------
     12. PRODUCT MODAL
     ------------------------------------------------------------------------ */
  function initProductModal() {
    var modal = document.querySelector('.product-modal');
    if (!modal) return;

    var overlay = modal.querySelector('.product-modal__overlay');
    var closeBtn = modal.querySelector('.product-modal__close');
    var modalName = modal.querySelector('.product-modal__name');
    var modalCategory = modal.querySelector('.product-modal__category');
    var modalPrice = modal.querySelector('.product-modal__price');
    var modalDesc = modal.querySelector('.product-modal__desc');
    var modalImage = modal.querySelector('.product-modal__image');

    // Open modal buttons
    document.querySelectorAll('[data-open-product]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = this.closest('.product-card');
        if (!card) return;

        // Populate modal
        if (modalName) modalName.textContent = card.querySelector('.product-card__name').textContent;
        if (modalCategory) modalCategory.textContent = card.querySelector('.product-card__category').textContent;
        if (modalPrice) modalPrice.textContent = card.querySelector('.product-card__price').textContent;
        if (modalDesc) modalDesc.textContent = card.getAttribute('data-description') || '';

        // Links de compra/interesse por produto (decisão da reunião: Comprar + Saiba mais)
        var prodNome = card.querySelector('.product-card__name').textContent;
        var prodPreco = card.querySelector('.product-card__price').textContent;
        var buyBtn = modal.querySelector('[data-buy]');
        var interestBtn = modal.querySelector('[data-interest]');
        if (buyBtn) buyBtn.href = whatsappUrl('Olá! Quero comprar: ' + prodNome + ' (' + prodPreco + ').');
        if (interestBtn) interestBtn.href = whatsappUrl('Olá! Quero saber mais sobre: ' + prodNome + '.');
        if (modalImage) {
          modalImage.style.background = card.querySelector('.product-card__image').style.background;
        }

        modal.classList.add('product-modal--open');
        document.body.style.overflow = 'hidden';

        // Focus trap
        closeBtn.focus();
      });
    });

    function closeModal() {
      modal.classList.remove('product-modal--open');
      document.body.style.overflow = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('product-modal--open')) {
        closeModal();
      }
    });
  }

  /* ------------------------------------------------------------------------
     13. BLOG SEARCH — Expand animation on focus
     ------------------------------------------------------------------------ */
  function initBlogSearch() {
    var searchInput = document.querySelector('.blog-search__input');
    var searchWrap = document.querySelector('.blog-search');
    if (!searchInput || !searchWrap) return;

    searchInput.addEventListener('focus', function () {
      searchWrap.style.maxWidth = '500px';
    });

    searchInput.addEventListener('blur', function () {
      if (!this.value) {
        searchWrap.style.maxWidth = '400px';
      }
    });
  }

  /* ------------------------------------------------------------------------
     14. ARTICLE TOC — Active state on scroll
     ------------------------------------------------------------------------ */
  function initArticleTOC() {
    var tocLinks = document.querySelectorAll('.article-toc__link');
    var headings = [];
    if (!tocLinks.length) return;

    tocLinks.forEach(function (link) {
      var targetId = link.getAttribute('href');
      if (targetId) {
        var heading = document.querySelector(targetId);
        if (heading) headings.push({ el: heading, link: link });
      }
    });

    if (!headings.length) return;

    function updateActive() {
      var scrollPos = window.scrollY + 120;
      var current = headings[0];

      for (var i = 0; i < headings.length; i++) {
        if (headings[i].el.offsetTop <= scrollPos) {
          current = headings[i];
        }
      }

      tocLinks.forEach(function (l) { l.classList.remove('article-toc__link--active'); });
      if (current) current.link.classList.add('article-toc__link--active');
    }

    window.addEventListener('scroll', updateActive, { passive: true });
    updateActive();
  }

  /* ------------------------------------------------------------------------
     15. SKELETON LOADING — Simulate loading states
     ------------------------------------------------------------------------ */
  function initSkeletonLoading() {
    var skeletonContainers = document.querySelectorAll('[data-skeleton]');
    if (!skeletonContainers.length) return;

    // Remove skeletons after content loads (simulated for static site)
    setTimeout(function () {
      skeletonContainers.forEach(function (container) {
        var skeletons = container.querySelectorAll('.skeleton');
        skeletons.forEach(function (s) { s.remove(); });
        // Show actual content
        var content = container.querySelectorAll('[data-skeleton-content]');
        content.forEach(function (c) { c.style.display = ''; });
      });
    }, 800);
  }

  /* ------------------------------------------------------------------------
     X. DOAÇÃO — chave Pix (copiar) + agradecimento no WhatsApp
     ------------------------------------------------------------------------ */
  function initDonation() {
    var keyEl = document.querySelector('[data-pix-key]');
    if (!keyEl) return;

    var copyBtn = document.querySelector('[data-pix-copy]');
    var note = document.querySelector('[data-pix-note]');

    if (PIX_KEY) {
      keyEl.textContent = PIX_KEY;
      if (copyBtn) {
        copyBtn.hidden = false;
        copyBtn.addEventListener('click', function () {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(PIX_KEY).then(function () {
              var original = copyBtn.textContent;
              copyBtn.textContent = 'Copiado ✓';
              setTimeout(function () { copyBtn.textContent = original; }, 2200);
            }).catch(function () {});
          }
        });
      }
      if (note) note.hidden = true;
    } else {
      keyEl.textContent = 'em configuração';
      if (copyBtn) copyBtn.hidden = true;
      if (note) note.hidden = false;
    }

    var waBtn = document.querySelector('[data-doar-whatsapp]');
    if (waBtn) {
      waBtn.href = whatsappUrl('Olá! Acabei de fazer uma doação para a Diamba Sagrada. Quero apoiar a causa. 🌿');
    }
  }

  /* ------------------------------------------------------------------------
     X. RECEITA — formulário de envio de receita médica (área médica) → webhook
     ------------------------------------------------------------------------ */
  function initReceitaForm() {
    var form = document.getElementById('receita-form');
    if (!form) return;

    var waBtn = form.querySelector('[data-receita-whatsapp]');
    if (waBtn) {
      waBtn.href = whatsappUrl('Olá! Quero enviar minha receita médica para a Diamba Sagrada.');
    }

    function clearError(input) {
      var fg = input.closest('.form-group');
      var errorEl = fg ? fg.querySelector('.form-error') : null;
      if (errorEl) errorEl.classList.remove('form-error--visible');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var valid = true;
      var firstInvalid = null;
      form.querySelectorAll('[required]').forEach(function (input) {
        var fg = input.closest('.form-group');
        var errorEl = fg ? fg.querySelector('.form-error') : null;
        var ok;
        if (input.type === 'checkbox') ok = input.checked;
        else if (input.type === 'file') ok = input.files && input.files.length > 0;
        else ok = !!input.value.trim();
        if (!ok) {
          valid = false;
          if (errorEl) errorEl.classList.add('form-error--visible');
          if (!firstInvalid) firstInvalid = input;
        } else if (errorEl) {
          errorEl.classList.remove('form-error--visible');
        }
      });
      if (!valid) {
        if (firstInvalid && firstInvalid.focus) firstInvalid.focus();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      var original = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

      submitFormToWebhook(form)
        .then(function () {
          var success = form.querySelector('[data-receita-success]');
          if (success) success.hidden = false;
          Array.prototype.forEach.call(
            form.querySelectorAll('.form-row, .form-group, .receita-form__actions'),
            function (el) { el.style.display = 'none'; }
          );
        })
        .catch(function (err) {
          console.error('Erro ao enviar receita:', err);
          if (btn) { btn.disabled = false; btn.innerHTML = original || 'Tentar novamente'; }
          alert('Não foi possível enviar agora. Tente novamente em instantes.');
        });
    });

    form.querySelectorAll('.form-input, input[type="file"], input[type="checkbox"]').forEach(function (input) {
      input.addEventListener('input', function () { clearError(input); });
      input.addEventListener('change', function () { clearError(input); });
    });
  }

  /* ------------------------------------------------------------------------
     16. INIT — Run all modules on DOMContentLoaded
     ------------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    initPageLoad();
    initScrollReveal();
    initSmoothScroll();
    initAccordion();
    initMultiStepForm();
    initFileUpload();
    initBackToTop();
    initCookieConsent();
    initBlogFilters();
    initContactForm();
    initProductModal();
    initBlogSearch();
    initArticleTOC();
    initSkeletonLoading();
    initDonation();
    initReceitaForm();
  });
})();
