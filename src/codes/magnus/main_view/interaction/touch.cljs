(ns codes.magnus.main-view.interaction.touch
  (:require [clojure.core.matrix :as mat]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]))

(defn send-custom-event!
  ([element type]
   (send-custom-event! element type nil))

  ([element type detail]
   (let [event (js/CustomEvent. type (js-obj "detail" detail))]
     (.dispatchEvent element event))))

(defn get-offset-pos [event element]
  (let [rect   (.getBoundingClientRect element)
        page-x (+ (.-left rect) (.-pageXOffset js/window))
        page-y (+ (.-top rect) (.-pageYOffset js/window))]
    (mat/sub [(.-pageX event) (.-pageY event)]
             [page-x page-y])))

(defn get-touches [event]
  (let [element (.-target event)]
    (->> (.-touches event)
         (map (fn [touch]
                [(.-identifier touch)
                 (get-offset-pos touch element)]))
         (into {}))))

(defn center
  ([touches] (center touches identity))
  ([touches t]
   (let [summed-positions (->> (vals touches)
                               (map t)
                               (reduce mat/add [0 0]))]
     (mat/div summed-positions (count touches)))))


(defn distance
  ([touches] (distance touches identity))
  ([touches t]
   (assert (= 2 (count touches)))
   (let [[touch-1 touch-2] (vals touches)]
     (mat/distance (t touch-1) (t touch-2)))))


(defn handle-touch! [{:keys [namespace get-pos element support-camera-gestures event]}] 
  (.preventDefault event)
  (let [previous-touches (re/rget *state namespace :touches)
        new-touches      (get-touches event)
        pointer-pos      (get-pos element (first (vals new-touches)))]
    (swap! *state assoc-in [namespace :touches] new-touches)

    ; Handle dragging functionality. This only occurs when the user has exactly one 
    ; finger touching the screen. This can happen in two cases:
    ; 1. When there were 0 touches previously and th euser touches the screen with a 
    ;    finger.
    ; 2. When the user already touches the screen, i.e.: there is 1 touch already.
    ; Otherwise, we ensure that we no longer are dragging anything by dispatching the 
    ; end-drag event.
    (case [(count previous-touches) (count new-touches)]
      [0 1] (send-custom-event! element :interaction/start-drag {:pointer-pos pointer-pos})
      [1 1] (send-custom-event! element :interaction/drag {:pointer-pos pointer-pos})
      (send-custom-event! element :interaction/end-drag {:pointer-pos nil}))

    ; Now we handle touch gestures like panning and zooming
    (when (and support-camera-gestures
               (= (count previous-touches) 2)
               (= (count new-touches) 2))
      (let [to-simulation (comp :simulation (partial get-pos element))
            [dx dy] (mat/sub (center previous-touches to-simulation)
                             (center new-touches to-simulation))
            scale (mat/div (distance previous-touches to-simulation)
                           (distance new-touches to-simulation))]
        (camera/transform-camera!
         (-> (camera/scale-matrix (center new-touches to-simulation) scale)
             (mat/mmul (camera/translate-matrix dx dy)))))))
  {:target :touch})
