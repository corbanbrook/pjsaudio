/*  
 *  PJSAudio.lib.js
 *
 *  PJSAudio - a comprehensive audio library for javascript/processing.js
 *  
 *  Created by Corban Brook on 2010-01-10.
 *  Copyright 2009 Cubic Productions. All rights reserved.
 *
 *
 *  PJSAudio is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Lesser General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  PJSAudio is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  Please contact corbanbrook@gmail.com if you seek alternate
 *  licensing terms for your project.
 *
 */

/*  
 *  PJSAudio - a comprehensive audio library for javascript/processing.js 
 *  
 *  Maintained by Corban Brook <corbanbrook@gmail.com>  
 *   
 */

(function(){ 

  Processing.lib.DFT = function(_bufferSize, _sampleRate) {
    var bufferSize = _bufferSize;
    var sampleRate = _sampleRate;
    
    var self = {
      spectrum: new Array(bufferSize/2),
      complexValues: new Array(bufferSize/2),
      
      buildTrigTables: function() {
        var N = bufferSize/2 * bufferSize;
        var TWO_PI = 2 * Math.PI;
        
        self.sinTable = new Array(N);
        self.cosTable = new Array(N);
        
        for ( var i = 0; i < N; i++ ) {
          self.sinTable[i] = Math.sin(i * TWO_PI / bufferSize);
          self.cosTable[i] = Math.cos(i * TWO_PI / bufferSize);
        }
      },
      
      forward: function(buffer) {
        for ( var k = 0; k < bufferSize/2; k ++ ) {
          var real = 0.0;
          var imag = 0.0;

          for ( var n = 0; n < buffer.length; n++ ) {
            real += self.cosTable[k*n] * signal[n];
            imag += self.sinTable[k*n] * signal[n];
          }

          self.complexValues[k] = {real: real, imag: imag};
        }
        
        for ( var i = 0; i < bufferSize/2; i++ ) {
          self.spectrum[i] = 2 * Math.sqrt(Math.pow(self.complexValues[i].real, 2) + Math.pow(self.complexValues[i].imag, 2)) / bufferSize;
        }

        return self.spectrum;
      }
    };
    
    self.buildTrigTables();
    
    return self;
  }; // END DFT
    
  Processing.lib.FFT = function(_bufferSize, _sampleRate) {
    var bufferSize = _bufferSize;
    var sampleRate = _sampleRate;

    var self = {
      spectrum: new Array(bufferSize/2),
      complexValues: new Array(bufferSize),
      
      buildReverseTable: function() {
        self.reverseTable = new Array(bufferSize);
        self.reverseTable[0] = 0;

        var limit = 1;
        var bit = bufferSize >> 1;

        while ( limit < bufferSize ) {
          for ( var i = 0; i < limit; i++ ) {
            self.reverseTable[i + limit] = self.reverseTable[i] + bit;
          }

          limit = limit << 1;
          bit = bit >> 1;
        }
      },
      
      buildTrigTables: function() {
        self.sinTable = new Array(bufferSize);
        self.cosTable = new Array(bufferSize);
        
        for ( var i = 0; i < bufferSize; i++ ) {
          self.sinTable[i] = Math.sin(-Math.PI/i);
          self.cosTable[i] = Math.cos(-Math.PI/i);
        }
      },
      
      forward: function(buffer) {
        if ( bufferSize % 2 != 0 ) throw "Invalid buffer size, must be a power of 2.";
        if ( bufferSize != buffer.length ) throw "Supplied buffer is not the same size as defined FFT. FFT Size: " + bufferSize + " Buffer Size: " + buffer.length;

        for ( var i = 0; i < buffer.length; i++ ) {
          self.complexValues[i] = {real: buffer[self.reverseTable[i]], imag: 0.0};
        }

        var halfSize = 1;

        while ( halfSize < buffer.length ) {
          var phaseShiftStepReal = self.cosTable[halfSize];
          var phaseShiftStepImag = self.sinTable[halfSize];
          var currentPhaseShiftReal = 1.0;
          var currentPhaseShiftImag = 0.0;

          for ( var fftStep = 0; fftStep < halfSize; fftStep++ ) {
            var i = fftStep;

            while ( i < buffer.length ) {
              var off = i + halfSize;
              var tr = (currentPhaseShiftReal * self.complexValues[off].real) - (currentPhaseShiftImag * self.complexValues[off].imag);
              var ti = (currentPhaseShiftReal * self.complexValues[off].imag) + (currentPhaseShiftImag * self.complexValues[off].real);

              self.complexValues[off].real = self.complexValues[i].real - tr;
              self.complexValues[off].imag = self.complexValues[i].imag - ti;
              self.complexValues[i].real += tr;
              self.complexValues[i].imag += ti;

              i += halfSize << 1;
            }

            var tmpReal = currentPhaseShiftReal;
            currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
            currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
          }

          halfSize = halfSize << 1;
        }

        for ( var i = 0; i < bufferSize/2; i++ ) {
          self.spectrum[i] = 2 * Math.sqrt(Math.pow(self.complexValues[i].real, 2) + Math.pow(self.complexValues[i].imag, 2)) / bufferSize;
        }
        
        return self.spectrum;
      }
    }
    
    self.buildReverseTable();
    self.buildTrigTables();

    return self;
  }; // END FFT
  
  /*  Oscillator Signal Generator
   *    
   *  Usage: var sine = Oscillator(SINEWAVE, 440.0, 1, 2048, 44100);
   *         var signal = sine.generate();
   *
   */
  
  Processing.lib.PJSAudio = {
    SINEWAVE:     1,
    SQUAREWAVE:   2,
    SAWWAVE:      3,
    TRIANGLEWAVE: 4
  };
  
  Processing.lib.Oscillator = function(_waveform, _frequency, _amplitude, _bufferSize, _sampleRate) {
    var waveform = _waveform;
    var frequency = _frequency;
    var amplitude = _amplitude;
    var bufferSize = _bufferSize;
    var sampleRate = _sampleRate;
    var waveLength;
    var frameCount = 0;
    
    var cyclesPerSample = frequency / sampleRate;
    
    var TWO_PI = 2*Math.PI;
    
    var calcWaveLength = function() {
      var waveLengthSize = Math.round(sampleRate / frequency);
      waveLength = new Array(waveLengthSize);
      
      for ( var i = 0; i < waveLengthSize; i++ ) {
        var value;
        var step = i * cyclesPerSample % 1;

        switch(waveform) {
          case Processing.SINEWAVE:
            value = Math.sin(TWO_PI * step);
            break;
          case Processing.SQUAREWAVE:
            value = step < 0.5 ? 1 : -1;
            break;
          case Processing.SAWWAVE:
            value = 2 * (step - Math.round(step));
            break;
          case Processing.TRIANGLEWAVE:
            value = 1 - 4 * Math.abs(Math.round(step) - step);
            break;
        }
        waveLength[i] = value * amplitude;
      }
    }
    
    calcWaveLength();
    
    var self = {
      signal: new Array(bufferSize),
      envelope: null,
      envelopedSignal: new Array(bufferSize),
      
      setAmp: function(_amplitude) {
        if (_amplitude >= 0 && _amplitude <= 1) {
          amplitude = _amplitude;
          calcWaveLength();
        } else {
          throw "Amplitude out of range (0..1).";
        }
      },
      
      setFreq: function(_frequency) {
        frequency = _frequency;
        cyclesPerSample = frequency / sampleRate;
        calcWaveLength();
      },
      
      // Add a oscillator
      add: function(_oscillator) {
        for ( var i = 0; i < bufferSize; i++ ) {
          self.signal[i] += _oscillator.valueAt(i);
        }
        
        return self.signal;
      },
      
      // Add a signal to the current generated osc signal
      addSignal: function(_signal) {
        for ( var i = 0; i < _signal.length; i++ ) {
          if ( i >= bufferSize ) {
            break;
          }
          self.signal[i] += _signal[i];
        }
        return self.signal;
      },
      
      // Add an envelope to the oscillator
      addEnvelope: function(_envelope) {
        self.envelope = _envelope;
      },
      
      valueAt: function(_offset) {
        return waveLength[_offset % waveLength.length];
      },
      
      generate: function() {
        var frameOffset = frameCount * bufferSize;
        var offset;
        var waveLengthSize = waveLength.length;
        
        for ( var i = 0; i < bufferSize; i++ ) {
          offset = (frameOffset + i) % waveLengthSize;

          if ( self.envelope != null ) {
            self.signal[i] = self.envelope.processSample(waveLength[offset]);
          } else {
            self.signal[i] = waveLength[offset];
          }
        }
        
        frameCount++;
        
        return self.signal;
      }
    };
    
    return self;
  }; // END Oscillator
  
  Processing.lib.ADSR = function(_attackLength, _decayLength, _sustainLevel, _sustainLength, _releaseLength, _sampleRate) {
    var attackLength  = _attackLength;
    var decayLength   = _decayLength;
    var sustainLevel  = _sustainLevel;
    var sustainLength = _sustainLength;
    var releaseLength = _releaseLength;
    var sampleRate    = _sampleRate;
    
    var attackSamples  = attackLength * sampleRate;
    var decaySamples   = decayLength * sampleRate;
    var sustainSamples = sustainLength * sampleRate;
    var releaseSamples = releaseLength * sampleRate;
    
    var attack = attackSamples;
    var decay = attack + decaySamples;
    var sustain = decay + sustainSamples;
    var release = sustain + releaseSamples;
    
    var samplesProcessed = 0;
    
    var self = {
      trigger: function() {
        samplesProcessed = 0;
      },
      
      process: function(_buffer) {
        for ( var i = 0; i < _buffer.length; i++ ) {
          var amplitude = 0;
          
          if ( samplesProcessed <= attack ) {
            amplitude = 0 + (1 - 0) * ((samplesProcessed - 0) / (attack - 0));
          } 
          else if ( samplesProcessed > attack && samplesProcessed <= decay ) {
            amplitude = 1 + (sustainLevel - 1) * ((samplesProcessed - attack) / (decay - attack));
          } 
          else if ( samplesProcessed > decay && samplesProcessed <= sustain ) {
            amplitude = sustainLevel;
          } 
          else if ( samplesProcessed > sustain && samplesProcessed <= release ) {
            amplitude = sustainLevel + (0 - sustainLevel) * ((samplesProcessed - sustain) / (release - sustain));
          }
          
          _buffer[i] *= amplitude;
          samplesProcessed++;
        }
        
        return _buffer;
      },
      
      processSample: function(_sample) {
        var amplitude = 0;
        
        if ( samplesProcessed <= attack ) {
          amplitude = 0 + (1 - 0) * ((samplesProcessed - 0) / (attack - 0));
        } 
        else if ( samplesProcessed > attack && samplesProcessed <= decay ) {
          amplitude = 1 + (sustainLevel - 1) * ((samplesProcessed - attack) / (decay - attack));
        } 
        else if ( samplesProcessed > decay && samplesProcessed <= sustain ) {
          amplitude = sustainLevel;
        } 
        else if ( samplesProcessed > sustain && samplesProcessed <= release ) {
          amplitude = sustainLevel + (0 - sustainLevel) * ((samplesProcessed - sustain) / (release - sustain));
        }
        
        samplesProcessed++;
        
        return _sample * amplitude;
      },
      
      isActive: function() {
        if ( samplesProcessed > release ) {
          return false;
        } else {
          return true;
        }
      }
    };
    
    return self;
  }; // END ADSR
  
  Processing.lib.PJSAudio.LOWPASS =  1;
  Processing.lib.PJSAudio.HIGHPASS = 2;
  
  Processing.lib.IIRFilter = function(_filter, _frequency, _sampleRate) {
    var filter = _filter;
    var frequency = _frequency;
    var sampleRate = _sampleRate;
    
    var a = [];
    var b = [];
    
    var calcCoeff = function() {
      var fracFreq = frequency/sampleRate;
      switch(filter) {
      case Processing.LOWPASS:
        var x = Math.exp(-2*Math.PI * fracFreq);
            a = [ 1 - x ];
            b = [ x ];
        break;
      case Processing.HIGHPASS:
        var x = Math.exp(-2 * Math.PI * fracFreq);
            a = [ (1+x)/2, -(1+x)/2 ];
            b = [ x ];
        break;
      }
    }
    
    calcCoeff();

    var memSize = (a.length >= b.length) ? a.length: b.length;

    var input = new Array(memSize);
    var output = new Array(memSize);
    
    for ( var i = 0; i < memSize; i++ ) {
      input[i] = 0;
      output[i] = 0;
    }
    
    var self = {
      setFreq: function(_frequency) {
        frequency = _frequency;
        calcCoeff();
      },
      
      process: function(_buffer) {
        for ( var i = 0; i < _buffer.length; i++ ) {
          var inputLength = input.length;
          for ( var c = 0; c < inputLength -1; c++ ) {
            input[c+1] = input[c];
          }
          
          input[0] = _buffer[i];
        
          var y = 0;
          for ( var j = 0; j < a.length; j++ ) {
            y += a[j] * input[j]; 
          }
          for ( var j = 0; j < b.length; j++ ) {
            y += b[j] * output[j];
          }
          
          var outputLength = output.length;
          for ( var c = 0; c < outputLength -1; c++ ) {
            output[c+1] = output[c];
          }
          
          output[0] = y;     
          _buffer[i] = y;
        }
      }
    };
    
    return self;
  }; // END IIRFilter
  
  Processing.lib.LP12 = function(_cutoff, _resonance, _sampleRate) {
    var cutoff, resonance, sampleRate = _sampleRate;
    
    var w, q, r, c, vibraPos = 0, vibraSpeed = 0;
    
    var calcCoeff = function(_cutoff, _resonance) {
      w = 2.0 * Math.PI * _cutoff / sampleRate;
      q = 1.0 - w / (2.0 * (_resonance + 0.5 / (1.0 + w)) + w - 2.0);
      r = q * q;
      c = r + 1.0 - 2.0 * Math.cos(w) * q;
      
      cutoff = _cutoff;
      resonance = _resonance;
    }

    calcCoeff(_cutoff, _resonance);
    
    var self = {
      set: function(_cutoff, _resonance) {
        calcCoeff(_cutoff, _resonance);
      },
      
      process: function(_buffer) {
        for ( var i = 0; i < _buffer.length; i++ ) {
          vibraSpeed += (_buffer[i] - vibraPos) * c;
          vibraPos += vibraSpeed;
          vibraSpeed *= r;
          
          /*
          var temp = vibraPos;
          
          if ( temp > 1.0 ) {
            temp = 1.0;
          } else if ( temp < -1.0 ) {
            temp = -1.0;
          }
          
          _buffer[i] = temp;
          */
          
          _buffer[i] = vibraPos;
        }
      }
    };
    
    return self;   
  }; // END LP12
  
})();