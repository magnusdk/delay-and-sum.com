(ns codes.magnus.export.field-ii
  (:require [clojure.string :as s]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]))



(def field-ii-template
  "field_init(0);

% It takes 1/lambdas_per_timestep timesteps to finish one wave period
lambdas_per_timestep = 1/128;

samples_x = [${xs}]';
samples_z = [${zs}]';
samples = [${samples}]';

c0 = ${sound-speed};                                  % Speed of sound [m/s]
f0 = ${center-frequency};                             % Center frequency of transmitted pulse [Hz]
fs = f0 / lambdas_per_timestep;                       % Sampling frequency [Hz]
time = ${time};                                       % Current time of the simulation [s]
no_elements = ${n-elements};                          % Number of transducer elements
aperture_size = ${array-width};                       % Size of aperture [m]
element_size = c0 / f0 / 1024;                        % Elements are really really small (basically point sources) [m]
element_size = aperture_size / (no_elements-1);
% Set kerf [m] (distance between elements) such that the aperture has size aperture_size
kerf = aperture_size / (no_elements-1) - element_size;
focus = [${virtual-source-x} 0 ${virtual-source-z}];  % Focus point (for focused transmits)

set_field('c', c0);              % Speed of sound [m/s]
set_field('fs', fs);             % Sampling frequency [Hz]
set_field('use_rectangles', 1);  % use rectangular elements

% Define pulse
pulse_length = ${pulse-length};  % delay-and-sum.com uses pulse length: an approximation of the number of wavelengths in one pulse. Perhaps we should use fractional bandwidth instead? :)
% fractional_bandwidth can be approximated from pulse_length like so (not sure if this is theoretically correct):
fractional_bandwidth = 1.05 / pulse_length;
impulse_response_cutoff_t = gauspuls('cutoff', f0, fractional_bandwidth, [], -60);
impulse_response_t  = -impulse_response_cutoff_t : (lambdas_per_timestep/f0) : impulse_response_cutoff_t;
impulse_response = gauspuls(impulse_response_t, f0, fractional_bandwidth);
impulse_response = impulse_response-mean(impulse_response);  % Get rid of DC

no_sub_x = 1; no_sub_y = 1;
Th = xdc_linear_array(no_elements, element_size, element_size, kerf, no_sub_x, no_sub_y, focus);
xdc_impulse(Th, impulse_response);

focusing_delays = xdc_get(Th, 'focus');
center_element_focusing_delay = interp1(1:no_elements, focusing_delays(2:end), no_elements/2);

points = cat(2, samples_x, zeros(size(samples_x)), samples_z);
[h, start_time] = calc_hp(Th, points);
time_index = ( ...
        time ...
        - start_time ...
        - center_element_focusing_delay ...
        + impulse_response_cutoff_t ...
    )*fs;
result = h;
result = hilbert(result);
result = squeeze(interp1(1:size(result,1), result, time_index));
result = abs(result);
max_amplitude = max(result, [], 'all');
result = result/max_amplitude;
%%
ss = abs(samples).^2;
ss = ss/max(ss, [], 'all');
plot(samples_x*1e3, 20*log10(ss));
hold on;
plot(samples_x*1e3, 20*log10(result.^2));
ylim([-100, 0]);
xlim([samples_x(1)*1e3, samples_x(end)*1e3]);
xlabel('x [mm]')
ylabel('Pressure [dB]')
legend('delay-and-sum.com', 'Field II');
")


(let [xs               (.toString (clj->js [1 2 3]))
      zs               (.toString (clj->js [1 2 3]))
      samples          (.toString (clj->js [1 2 3]))
      sound-speed      (str (re/rget *state :sound-speed))
      center-frequency (str (re/rget *state :center-frequency))
      time             (str (re/rget *state :time))
      n-elements       (str (re/rget *state :probe :n-elements))
      array-width      (str (re/rget *state :probe :array-width))
      pulse-length     (str (re/rget *state :pulse-length))
      [virtual-source-x virtual-source-z] (re/rget *state :virtual-source)
      virtual-source-x (str virtual-source-x)
      virtual-source-z (str virtual-source-z)]
  (-> field-ii-template
      (s/replace "${xs}" xs)
      (s/replace "${zs}" zs)
      (s/replace "${samples}" samples)
      (s/replace "${sound-speed}" sound-speed)
      (s/replace "${center-frequency}" center-frequency)
      (s/replace "${time}" time)
      (s/replace "${n-elements}" n-elements)
      (s/replace "${array-width}" array-width)
      (s/replace "${virtual-source-x}" virtual-source-x)
      (s/replace "${virtual-source-z}" virtual-source-z)
      (s/replace "${pulse-length}" pulse-length)
      (js/console.log)))

(let [[virtual-source-x virtual-source-z] (re/rget *state :virtual-source)]
  [virtual-source-x virtual-source-z])
(js/console.log (.toString (clj->js [1 2 3])))