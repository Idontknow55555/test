let slider = document.querySelector(".slider");
let btnLogin = document.querySelector(".left");
let btnLogin2 = document.querySelector(".right");
let ainmation = document.querySelector(".animation");
let btnX = document.querySelector(".close-button");
let btnX2 = document.querySelector(".close-button2");
let slider2 = document.querySelector(".slider2");
let setacc = document.querySelector(".set-acc");
let logacc = document.querySelector(".log-acc");
let start = document.querySelector(".start");
let body = document.body;

function disableScroll() {
  body.style.overflow = "hidden";
}

function enableScroll() {
  body.style.overflow = "auto";
}

function slideOut(element, animation) {
  return new Promise((resolve) => {
    element.style.animation = animation;
    element.addEventListener(
      "animationend",
      () => {
        element.style.display = "none";
        resolve();
      },
      { once: true }
    );
  });
}

btnLogin.addEventListener("click", () => {
  ainmation.style.display = "block";
  slider.style.display = "flex";
  slider.style.animation = "fadeInFromBottom 0.5s ease-out forwards";
  slider2.style.display = "none";
  disableScroll();
});

btnLogin2.addEventListener("click", () => {
  ainmation.style.display = "block";
  slider2.style.display = "flex";
  slider2.style.animation = "fadeInFromBottom2 0.5s ease-out forwards";
  slider.style.display = "none";
  disableScroll();
});

async function handleClose(sliderElement, animation) {
  await slideOut(sliderElement, animation);
  ainmation.style.display = "none";
  enableScroll();
}

btnX.addEventListener("click", () =>
  handleClose(slider, "fadeInFromBottom-1 0.5s ease-in forwards")
);
btnX2.addEventListener("click", () =>
  handleClose(slider2, "fadeInFromBottom2-1 0.5s ease-in forwards")
);

setacc.addEventListener("click", () => {
  slider.style.display = "none";
  slider2.style.display = "flex";
  slider2.style.animation = "fadeInFromBottom2 0.5s ease-out forwards";
  disableScroll();
});

logacc.addEventListener("click", () => {
  slider2.style.display = "none";
  slider.style.display = "flex";
  slider.style.animation = "fadeInFromBottom 0.5s ease-out forwards";
  disableScroll();
});

ainmation.addEventListener("click", async (event) => {
  if (event.target === ainmation) {
    if (slider.style.display === "flex") {
      await handleClose(slider, "fadeInFromBottom-1 0.5s ease-in forwards");
    } else if (slider2.style.display === "flex") {
      await handleClose(slider2, "fadeInFromBottom2-1 0.5s ease-in forwards");
    } else {
      ainmation.style.display = "none";
      enableScroll();
    }
  }
});
