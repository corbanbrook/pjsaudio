/*
 *  pjsaudio.lib.js
 *
 *  PJSAudio - a comprehensive audio library for javascript and processing.js
 *             by Corban Brook
 *
 *  Created by Corban Brook on 2010-01-10.
 *  Copyright 2010 Corban Brook. All rights reserved.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  Please contact corbanbrook@gmail.com if you seek alternate
 *  liscencing terms for your project.
 *
 */  
    
    p.DFT = function(_bufferSize, _sampleRate) {
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
    }
      
    p.FFT = function(_bufferSize, _sampleRate) {
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
    }
    
    /*  Oscillator Signal Generator
     *    
     *  Usage: var sine = Oscillator(SINEWAVE, 440.0, 1, 2048, 44100);
     *         var signal = sine.generate();
     *
     */
     
    SINEWAVE = 1;
    SQUAREWAVE = 2;
    SAWWAVE = 3;
    TRIANGLEWAVE =4;
    
    p.Oscillator = function(_waveform, _frequency, _amplitude, _bufferSize, _sampleRate) {
      var waveform = _waveform;
      var frequency = _frequency;
      var amplitude = _amplitude;
      var bufferSize = _bufferSize;
      var sampleRate = _sampleRate;
      
      var frameCount = 0;
      
      var cyclesPerSample = frequency / sampleRate;
      
      var TWO_PI = 2*Math.PI;
      
      var self = {
        signal: new Array(bufferSize),
        
        setAmp: function(_amplitude) {
          if (_amplitude >= 0 && _amplitude <= 1) {
            amplitude = _amplitude;
          } else {
            throw "Amplitude out of range (0..1).";
          }
        },
        
        setFreq: function(_frequency) {
          frequency = _frequency;
          cyclesPerSample = frequency / sampleRate;
        },
        
        add: function(_oscillator) {
          for ( var i = 0; i < bufferSize; i++ ) {
            self.signal[i] += _oscillator.valueAt(i);
          }
          
          return self.signal;
        },
        
        valueAt: function(_offset) {
          var value;
          var step = _offset * cyclesPerSample % 1;
          
          switch(waveform) {
            case SINEWAVE:
              value = Math.sin(TWO_PI * step);
              break;
            case SQUAREWAVE:
              value = step < 0.5 ? 1 : -1;
              break;
            case SAWWAVE:
              value = 2 * (step - Math.round(step));
              break;
            case TRIANGLEWAVE:
              value = 1 - 4 * Math.abs(Math.round(step) - step);
              break;
          }
          
          return value * amplitude;
        },
        
        generate: function() {
          var frameOffset = frameCount * bufferSize;
          for ( var i = 0; i < bufferSize; i++ ) {
            self.signal[i] = self.valueAt(frameOffset + i);
          }
          frameCount++;
          
          return self.signal;
        }
      };
      
      return self;
    }
    
    p.ADSR = function(_attackLength, _decayLength, _sustainLevel, _sustainLength, _releaseLength, _sampleRate) {
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
        }
      };
      
      return self;
    }
    
    /*
     *  BeatDetektor.js
     *
     *  BeatDetektor - CubicFX Visualizer Beat Detection & Analysis Algorithm
     *  Javascript port by Charles J. Cliffe and Corban Brook
     *
     *  Created by Charles J. Cliffe on 09-11-30.
     *  Copyright 2009 Cubic Productions. All rights reserved.
     *
     *  This program is free software: you can redistribute it and/or modify
     *  it under the terms of the GNU General Public License as published by
     *  the Free Software Foundation, either version 3 of the License, or
     *  (at your option) any later version.
     *
     *  This program is distributed in the hope that it will be useful,
     *  but WITHOUT ANY WARRANTY; without even the implied warranty of
     *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
     *  GNU General Public License for more details.
     *
     *  You should have received a copy of the GNU General Public License
     *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
     *
     *  Please contact cj@cubicproductions.com if you seek alternate
     *  liscencing terms for your project.
     *
     */

    /* 
     BeatDetektor class

     Restrictions:

     Input:

     bpm_maximum must be within the range of (bpm_minimum*2)-1
     i.e. minimum of 50 must have a maximum of 99 because 50*2 = 100

     Technical:

     feeding a perfect signal (alternating value repeating exactly on all channels) will 
     yield no results as the algorithm depends on some frequencies having a better average 
     detection than others so that there's a focus window.

     Modifying Configuration Kernel:

     most of the ratios and values have been reverse-engineered from visual observation and graphing
     of output values from various aspects of the detection triggers so not all parameters have
     a perfect definition yet, comments for these parameters will be updated as analysis 
     of their direct effect is explored.

    */
    BeatDetektor = function(bpm_minimum, bpm_maximum)
    {
    	if (typeof(bpm_minimum)=='undefined') bpm_minimum = 90.0;
    	if (typeof(bpm_maximum)=='undefined') bpm_maximum = 179.0

    	this.config = BeatDetektor.config;

    	this.BPM_MIN = bpm_minimum;
    	this.BPM_MAX = bpm_maximum;

    	this.beat_counter = 0;
    	this.half_counter = 0;
    	this.quarter_counter = 0;

    	// current average (this sample) for range n
    	this.a_freq_range = new Array(this.config.BD_DETECTION_RANGES);
    	// moving average of frequency range n
    	this.ma_freq_range = new Array(this.config.BD_DETECTION_RANGES);
    	// moving average of moving average of frequency range n
    	this.maa_freq_range = new Array(this.config.BD_DETECTION_RANGES);
    	// timestamp of last detection for frequecy range n
    	this.last_detection = new Array(this.config.BD_DETECTION_RANGES);

    	// moving average of gap lengths
    	this.ma_bpm_range = new Array(this.config.BD_DETECTION_RANGES);
    	// moving average of moving average of gap lengths
    	this.maa_bpm_range = new Array(this.config.BD_DETECTION_RANGES);

    	// range n quality attribute, good match  = quality+, bad match  = quality-, min  = 0
    	this.detection_quality = new Array(this.config.BD_DETECTION_RANGES);

    	// current trigger state for range n
    	this.detection = new Array(this.config.BD_DETECTION_RANGES); 

    	this.reset();

    	if (typeof(console)!='undefined')
    	{
    		console.log("BeatDetektor("+this.BPM_MIN+","+this.BPM_MAX+") created.")
    	}
    }

    BeatDetektor.prototype.reset = function()
    {
    	var bpm_avg = 60.0/((this.BPM_MIN+this.BPM_MAX)/2.0);

    	this.config = BeatDetektor.config;

    	for (var i = 0; i < this.config.BD_DETECTION_RANGES; i++)
    	{
    		this.a_freq_range[i] = 0.0;
    		this.ma_freq_range[i] = 0.0;
    		this.maa_freq_range[i] = 0.0;
    		this.last_detection[i] = 0.0;
    		this.ma_bpm_range[i] = bpm_avg;
    		this.maa_bpm_range[i] =bpm_avg;
    		this.detection_quality[i] = 0.0;
    		this.detection[i] = false;
    	}

    	this.bpm_contest = new Array();

    	this.quality_total = 0.0;
    	this.quality_avg = 0.0;
    	this.current_bpm = 0.0; 
    	this.winning_bpm = 0.0; 
    	this.win_val = 0.0;
    	this.win_bpm_int = 0;
    	this.bpm_predict = 0;

    	this.is_erratic = false;
    	this.bpm_offset = 0.0;
    	this.last_timer = 0.0;
    	this.last_update = 0.0;

    	this.bpm_timer = 0.0;
    	this.beat_counter = 0;
    	this.half_counter = 0;
    	this.quarter_counter = 0;
    }

    // Default configuration parameters
    BeatDetektor.config = {
    	BD_DETECTION_RANGES : 128,
    	BD_DETECTION_RATE : 10.0,
    	BD_DETECTION_FACTOR : 0.98,
    	BD_QUALITY_DECAY : 0.5,
    	BD_QUALITY_TOLERANCE : 0.9,
    	BD_QUALITY_REWARD : 1.0,
    	BD_QUALITY_LOSS : 0.2,
    	BD_QUALITY_STEP : 0.5,
    	BD_QUALITY_MINIMUM : 100.0,
    	BD_FINISH_LINE : 20.0,
    	BD_REWARD_TOLERANCES : [ 0.01, 0.04, 0.08, 0.1, 0.15, 0.2 ],  // 1%,  4%,  10%,  15%,  20%
    	BD_REWARD_MULTIPLIERS : [ 6.0, 4.0, 2.0, 0.5, 0.25, 0.125 ]
    };


    BeatDetektor.prototype.process = function(timer_seconds, fft_data)
    {
    	if (!this.last_timer) { this.last_timer = timer_seconds; return; }	// ignore 0 start time

    	var timestamp = timer_seconds;

    	this.last_update = timer_seconds - this.last_timer;
    	this.last_timer = timer_seconds;


    	var i,x;
    	var v;

    	var bpm_floor = 60.0/this.BPM_MAX;
    	var bpm_ceil = 60.0/this.BPM_MIN;

    	var range_step = (fft_data.length / this.config.BD_DETECTION_RANGES);
    	var range = 0;


    	for (x=0; x<fft_data.length; x+=range_step)
    	{
    		this.a_freq_range[range] = 0;

    		// accumulate frequency values for this range
    		for (i = x; i<x+range_step; i++)
    		{
    			v = Math.abs(fft_data[i]);
    			this.a_freq_range[range] += v;
    		}

    		// average for range
    		this.a_freq_range[range] /= range_step;

    		// two sets of averages chase this one at a 

    		// moving average, increment closer to a_freq_range at a rate of 1.0 / BD_DETECTION_RATE seconds
    		this.ma_freq_range[range] -= (this.ma_freq_range[range]-this.a_freq_range[range])*this.last_update*this.config.BD_DETECTION_RATE;
    		// moving average of moving average, increment closer to this.ma_freq_range at a rate of 1.0 / BD_DETECTION_RATE seconds
    		this.maa_freq_range[range] -= (this.maa_freq_range[range]-this.ma_freq_range[range])*this.last_update*this.config.BD_DETECTION_RATE;

    		// if closest moving average peaks above trailing (with a tolerance of BD_DETECTION_FACTOR) then trigger a detection for this range 
    		var det = (this.ma_freq_range[range]*this.config.BD_DETECTION_FACTOR >= this.maa_freq_range[range]);

    		// compute bpm clamps for comparison to gap lengths

    		// clamp detection averages to input ranges
    		if (this.ma_bpm_range[range] > bpm_ceil) this.ma_bpm_range[range] = bpm_ceil;
    		if (this.ma_bpm_range[range] < bpm_floor) this.ma_bpm_range[range] = bpm_floor;
    		if (this.maa_bpm_range[range] > bpm_ceil) this.maa_bpm_range[range] = bpm_ceil;
    		if (this.maa_bpm_range[range] < bpm_floor) this.maa_bpm_range[range] = bpm_floor;

    		// new detection since last, test it's quality
    		if (!this.detection[range] && det)
    		{
    			// calculate length of gap (since start of last trigger)
    			var trigger_gap = timestamp-this.last_detection[range];

    			var rewarded = false;
    			var quality_multiplier = 1.0;

    			// trigger falls within acceptable range, 
    			if (trigger_gap < bpm_ceil && trigger_gap > (bpm_floor))
    			{		
    				rewarded = false;
    				// compute gap and award quality

    				// use our tolerances as a funnel to edge detection towards the most likely value
    				for (i = 0; i < this.config.BD_REWARD_TOLERANCES.length; i++)
    				{
    					if (Math.abs(this.ma_bpm_range[range]-trigger_gap) < this.ma_bpm_range[range]*this.config.BD_REWARD_TOLERANCES[i])
    					{
    						this.detection_quality[range] += this.config.BD_QUALITY_REWARD * this.config.BD_REWARD_MULTIPLIERS[i]; 
    						quality_multiplier = 4.0 / i;
    						rewarded = true;
    					}
    				}				

    				if (rewarded) 
    				{
    					this.last_detection[range] = timestamp;
    				}
    				else
    				{
    					quality_multiplier = 0.2;
    				}
    			}
    			else if (trigger_gap >= bpm_ceil) // low quality, gap exceeds maximum time
    			{
    				// start a new gap test, next gap is guaranteed to be longer

    				rewarded = false;				

    				// test for 1/2 beat
    				trigger_gap /= 2.0;

    				if (trigger_gap < bpm_ceil && trigger_gap > (bpm_floor)) for (i = 0; i < this.config.BD_REWARD_TOLERANCES.length; i++)
    				{
    					if (Math.abs(this.ma_bpm_range[range]-trigger_gap) < this.ma_bpm_range[range]*this.config.BD_REWARD_TOLERANCES[i])
    					{
    						this.detection_quality[range] += this.config.BD_QUALITY_REWARD * this.config.BD_REWARD_MULTIPLIERS[i]; 
    						quality_multiplier = 4.0 / i;
    						rewarded = true;
    					}
    				}


    				// decrement quality if no 1/2 beat reward
    				if (!rewarded) 
    				{
    					this.last_detection[range] = timestamp;	
    					quality_multiplier = 0.2;
    				}
    			}
    			else
    			{
    				quality_multiplier = 0.5;
    			}

    			if (rewarded)
    			{
    				this.ma_bpm_range[range] -= (this.ma_bpm_range[range]-trigger_gap) * this.config.BD_QUALITY_STEP * quality_multiplier;
    				this.maa_bpm_range[range] -= (this.maa_bpm_range[range]-this.ma_bpm_range[range]) * this.config.BD_QUALITY_STEP * quality_multiplier;
    			}
    			else
    			{
    				this.detection_quality[range]-=this.config.BD_QUALITY_LOSS*quality_multiplier;
    			}

    		}

    		if (!det && this.detection[range]) this.detection_quality[range] *= this.config.BD_QUALITY_DECAY;
    		if (!det && timestamp-this.last_detection[range] > bpm_ceil) this.detection_quality[range] -= this.detection_quality[range]*this.config.BD_QUALITY_DECAY*this.last_update;

    		// quality bottomed out, set to 0
    		if (this.detection_quality[range] < 0) this.detection_quality[range]=0;

    		this.detection[range] = det;		

    		range++;
    	}

    	// total contribution weight
    	this.quality_total = 0;

    	// total of bpm values
    	var bpm_total = 0;
    	// number of bpm ranges that contributed to this test
    	var bpm_contributions = 0;


    	// accumulate quality weight total
    	for (x=0; x<this.config.BD_DETECTION_RANGES; x++)
    	{
    		this.quality_total += this.detection_quality[x];
    	}

    	// determine the average weight of each quality range
    	this.quality_avg = this.quality_total / this.config.BD_DETECTION_RANGES;

    	var avg_bpm_offset = 0.0;
    	var offset_test_bpm = this.current_bpm;
    	var draft = new Array();

    	// if the current weight of quality exceeds the minimum then run the test
    	if (this.quality_total >= this.config.BD_QUALITY_MINIMUM) 
    	for (x=0; x<this.config.BD_DETECTION_RANGES; x++)
    	{
    		// if this detection range weight*tolerance is higher than the average weight then add it's moving average contribution 
    		if (this.detection_quality[x]*this.config.BD_QUALITY_TOLERANCE >= this.quality_avg)
    		{
    			if (this.ma_bpm_range[x] < bpm_ceil && this.ma_bpm_range[x] > bpm_floor)
    			{
    				bpm_total += this.maa_bpm_range[x];

    				var idx = parseInt(Math.ceil(60.0/this.maa_bpm_range[x]));

    				if (typeof(draft[idx]=='undefined')) draft[idx] = 0;
    				draft[idx]++;

    				bpm_contributions++;
    				if (offset_test_bpm == 0.0) offset_test_bpm = this.ma_bpm_range[x];
    				else 
    				{
    					avg_bpm_offset += Math.abs(offset_test_bpm-this.ma_bpm_range[x]);
    				}
    			}
    		}
    	}

    	// if we have one or more contributions that pass criteria then attempt to display a guess
    	var has_prediction = (bpm_contributions>=4)?true:false;

    	var draft_winner=0;
    	var win_val = 0;

    	if (has_prediction) 
    	{
    		for (var draft_i in draft)
    		{
    			if (draft[draft_i] > win_val)
    			{
    				win_val = draft[draft_i];
    				draft_winner = draft_i;
    			}
    		}

    		this.bpm_predict = 60.0/draft_winner;

    		avg_bpm_offset /= bpm_contributions;
    		this.bpm_offset = avg_bpm_offset;

    		if (!this.current_bpm)  
    		{
    			this.current_bpm = this.bpm_predict; 
    		}
    	}

    	if (this.current_bpm && this.bpm_predict) this.current_bpm -= (this.current_bpm-this.bpm_predict)*this.config.BD_DETECTION_RATE*this.last_update;	


    	// hold a contest for bpm to find the current mode
    	var contest_max=0;

    	for (var contest_i in this.bpm_contest)
    	{
    		if (contest_max < this.bpm_contest[contest_i]) contest_max = this.bpm_contest[contest_i]; 
    	}


    	// normalize to a finish line
    	if (contest_max > this.config.BD_FINISH_LINE) 
    	{
    		for (var contest_i in this.bpm_contest)
    		{
    			this.bpm_contest[contest_i]=(this.bpm_contest[contest_i]/contest_max)*this.config.BD_FINISH_LINE;
    		}
    	}

    	// decay contest values from last loop
    	for (contest_i in this.bpm_contest)
    	{
    		this.bpm_contest[contest_i]-=this.bpm_contest[contest_i]*(this.last_update/this.config.BD_DETECTION_RATE);
    	}


    	this.bpm_timer+=this.last_update;

    	this.win_val = 0;

    	var winner = 0;

    	// attempt to display the beat at the beat interval ;)
    	if (this.bpm_timer > this.winning_bpm/4.0 && this.current_bpm)
    	{		
    		if (this.winning_bpm) while (this.bpm_timer > this.winning_bpm/4.0) this.bpm_timer -= this.winning_bpm/4.0;

    		// increment beat counter

    		this.quarter_counter++;		
    		this.half_counter= parseInt(this.quarter_counter/2);
    		this.beat_counter = parseInt(this.quarter_counter/4);

    		// award the winner of this iteration
    		var idx = parseInt(Math.floor(60.0/this.current_bpm));
    		if (typeof(this.bpm_contest[idx])=='undefined') this.bpm_contest[idx] = 0;
    		this.bpm_contest[idx]+=this.config.BD_QUALITY_REWARD;


    		// find the overall winner so far
    		for (var contest_i in this.bpm_contest)
    		{
    			if (this.win_val < this.bpm_contest[contest_i])
    			{
    				winner = contest_i;
    				this.win_val = this.bpm_contest[contest_i];
    			}
    		}

    		if (winner)
    		{
    			this.win_bpm_int = parseInt(winner);
    			this.winning_bpm = 60.0/winner;
    		}

    		if (typeof(console)!='undefined' && (this.beat_counter % 4) == 0) console.log("BeatDetektor("+this.BPM_MIN+","+this.BPM_MAX+"): [ Current Estimate: "+winner+" BPM ] [ Time: "+(parseInt(timer_seconds*1000.0)/1000.0)+"s, Quality: "+(parseInt(this.quality_total*1000.0)/1000.0)+", Rank: "+(parseInt(this.win_val*1000.0)/1000.0)+", Jitter: "+(parseInt(this.bpm_offset*1000000.0)/1000000.0)+" ]");
    	}
    }
    
    p.BeatDetektor = BeatDetektor;
