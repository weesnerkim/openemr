/**
 *
 * Copyright (C) 2016-2017 Jerry Padgett <sjpadgett@gmail.com>
 *
 * LICENSE: This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @package OpenEMR
 * @author Jerry Padgett <sjpadgett@gmail.com>
 * @link http://www.open-emr.org
 */

"use strict";
var net = require('net');
var to_json = require('xmljson').to_json;
//var bb = require('blue-button'); //for use set global-not needed here
var bbg = require('blue-button-generate');
//var bbm = require('blue-button-model'); //for use set global-not needed here

var server = net.createServer();
var conn = ''; // make our connection scope global to script
// some useful routines for populating template sections
function validate(toValidate, ref, retObj) {
	for (var p in ref) {
		if (typeof ref[p].dataType === "undefined") {
			retObj[p] = {};
			if (!toValidate[p]) toValidate[p] = {};
			validate(toValidate[p], ref[p], retObj[p]);
		} else {
			if (typeof toValidate === "undefined") toValidate = {};
			var trimmed = trim(toValidate[p]);
			retObj[p] = typeEnforcer(ref[p].dataType, trimmed);
		}
	}
	return retObj;
}
function typeEnforcer(type, val){
	var validVal;
	switch (type) {
	case "boolean":
		if (typeof val === "string") {
			validVal = val.toLowerCase() === "true";
		} else {
			validVal = !!val;
		}
		break;
	case "string":
		if ( (val === null) || (val === "undefined") || (typeof val === "undefined") ) {
			validVal = '';
		} else if (typeof val == "object") {
			validVal = '';
		} else {
			validVal = trim(String(val));
		}
		break;
	case "array":
		if (typeof val === 'undefined' || val === null) {
			validVal = [];
		} else if (Array.isArray(val)) {
			validVal = [];
			val.forEach(function(v) {
				validVal.push(trim(v));
			});
		} else {
			validVal = [trim(val)];
		}
		break;
	case "integer":
		var asInt = parseInt(val, 10);
		if (isNaN(asInt)) asInt = 0;
		validVal = asInt;
		break;
	case "number":
		var asNum = parseFloat(val);
		if (isNaN(asNum)) asNum = 0;
		validVal = asNum;
		break;
	}
	return validVal;
}
function trim(s) {
	if (typeof s === 'string') return s.trim();
	return s;
}
function safeId(s) {
	return trim(s).toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-').replace(/\-+$/, '');
}
function fDate(str) {
	/*
	 * Format dates to js required yyyy-mm-dd + zero hundred hours Yes I freely
	 * admit, I'm lazy!
	 */
	str = String(str); // at least ensure string so cast it...
	if (Number(str) === 0){return "0000-01-01T00:00:00.000Z";}
	if (str.length === 8 || (str.length === 14 && (1 * str.substring(12, 14)) === 0)) {
		// case yyyymmdd or yyyymmdd000000 called effectivetime by ccm.
		return [ str.slice(0, 4), str.slice(4, 6), str.slice(6, 8) ].join('-') + 'T00:00:00.000Z';
	} else if (str.length === 10 && (1 * str.substring(0, 2)) <= 12) {
		// case mm/dd/yyyy or mm-dd-yyyy
		return [ str.slice(6, 10), str.slice(0, 2), str.slice(3, 5) ].join('-') + 'T00:00:00.000Z';
	} else if (str.length === 14 && (1 * str.substring(12, 14)) > 0) {
		// maybe a real time so parse
	}
	return str + 'T00:00:00.000Z';
}
function isOne(who) {
	try{
		if (who !== null && typeof who === 'object') {
			return who.hasOwnProperty('extension') ? 1 : Object.keys(who).length;
		}
	}
	catch(e){ return false;}
	return 0;
}
function headReplace(content) {
	var r = '<?xml version="1.0" encoding="UTF-8"?>\n' + 
			'<ClinicalDocument xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:hl7-org:v3 http://xreg2.nist.gov:8080/hitspValidation/schema/cdar2c32/infrastructure/cda/C32_CDA.xsd"' + 
			' xmlns="urn:hl7-org:v3" xmlns:mif="urn:hl7-org:v3/mif">\n';
	r += content.substr(194);
	return r;
}
// Data model for Blue Button
function populateDemographic(pd, g) {
	return {
		"name" : {
			"middle" : [ pd.mname ],
			"last" : pd.lname,
			"first" : pd.fname
		},
		"dob" : {
			"point" : {
				"date" : fDate(pd.dob),
				"precision" : "day"
			}
		},
		"gender" : pd.gender,
		"identifiers" : [ {
			"identifier" : "2.16.840.1.113883.19.5.99999.2",
			"extension" : "998991"
		}, {
			"identifier" : "2.16.840.1.113883.4.1",
			"extension" : pd.ssn
		} ],
		"marital_status" : pd.status,
		"addresses" : [ {
			"street_lines" : [ pd.street ],
			"city" : pd.city,
			"state" : pd.state,
			"zip" : pd.postalCode,
			"country" : pd.country,
			"use" : "primary home"
		} ],
		"phone" : [ {
			"number" : pd.phone_home,
			"type" : "primary home"
		} ],
		"race" : "White",
		"ethnicity" : pd.ethnicity,
		"languages" : [ {
			"language" : pd.language,
			"preferred" : true,
			"mode" : "Expressed spoken",
			"proficiency" : "Good"
		} ],
		"religion" : pd.religion,
		"birthplace" : {
			"city" : "",
			"state" : "",
			"zip" : "",
			"country" : ""
		},
		"guardians" : [ {
			"relation" : g.relation,
			"addresses" : [ {
				"street_lines" : [ g.address ],
				"city" : g.city,
				"state" : g.state,
				"zip" : g.postalCode,
				"country" : g.country,
				"use" : "primary home"
			} ],
			"names" : [ {
				//"last" : "",
				//"first" : ""
				"name" : g.name
			} ],
			"phone" : [ {
				"number" : g.telecom,
				"type" : "primary home"
			} ]
		} ]
	};
}

function populateMedication(pd) {
	return {
		"date_time" : {
			"low" : {
				"date" : fDate(pd.start_date),
				"precision" : "day"
			},
			"high" : {
				"date" : fDate(pd.end_date),
				"precision" : "day"
			}
		},
		"identifiers" : [ {
			"identifier" : "cdbd33f0-6cde-11db-9fe1-0800200c9a66"
		} ],
		"status" : pd.status,
		"sig" : pd.direction,
		"product" : {
			"identifiers" : [ {
				"identifier" : "2a620155-9d11-439e-92b3-5d9815ff4ee8"
			} ],
			"unencoded_name" : pd.drug,
			"product" : {
				"name" : pd.drug,
				"code" : pd.rxnorm,
				"translations" : [ {
					"name" : pd.drug,
					"code" : pd.rxnorm,
					"code_system_name" : "RXNORM"
				} ],
				"code_system_name" : "RXNORM"
			},
			"manufacturer" : "UNK"
		},
		"supply" : {
			"date_time" : {
				"low" : {
					"date" : fDate(pd.start_date),
					"precision" : "day"
				}
			},
			"repeatNumber" : "NI",
			"quantity" : "NI",
			"author" : {
				"identifiers" : [ {
					"identifier" : "2a620155-9d11-439e-92b3-5d9815fe4de8"
				} ],
				"name" : {
					"prefix" : pd.title,
					"last" : pd.lname,
					"first" : pd.fname
				}
			}
		},
		"administration" : {
			"route" : {
				"name" : pd.route,
				"code" : pd.route_code,
				"code_system_name" : "Medication Route FDA"
			},
			"form" : {
				"name" : pd.form,
				"code" : pd.form_code,
				"code_system_name" : "Medication Route FDA"
			},
			"dose" : {
				"value" : parseFloat(pd.dosage),
				"unit" : pd.unit
			},
			"rate" : {
				"value" : 90,
				"unit" : "ml/min"
			},
			"interval" : {
				"period" : {
					"value" : parseFloat(pd.dosage),
					"unit" : pd.interval
				},
				"frequency" : true
			}
		},
		"performer" : {
			"organization" : [ {
				"identifiers" : [ {
					"identifier" : "2.16.840.1.113883.19.5.9999.1393"
				} ],
				"name" : [ pd.performer_name ]
			} ]
		},
		"drug_vehicle" : {
			"name" : pd.form,
			"code" : pd.form_code,
			"code_system_name" : "RXNORM"
		},
		"precondition" : {
			"code" : {
				"code" : "ASSERTION",
				"code_system_name" : "ActCode"
			},
			"value" : {
				"name" : "",
				"code" : "NI",
				"code_system_name" : "SNOMED CT"
			}
		},
		"indication" : {
			"identifiers" : [ {
				"identifier" : "db734647-fc99-424c-a864-7e3cda82e703",
				"extension" : "45665"
			} ],
			"code" : {
				"name" : "Finding",
				"code" : "404684003",
				"code_system_name" : "SNOMED CT"
			},
			"date_time" : {
				"low" : {
					"date" : fDate(pd.start_date),
					"precision" : "day"
				}
			},
			"value" : {
				"name" : pd.indications,
				"code" : "NI",
				"code_system_name" : "SNOMED CT"
			}
		},
		"dispense" : {
			"identifiers" : [ {
				"identifier" : "1.2.3.4.56789.1",
				"extension" : "cb734647-fc99-424c-a864-7e3cda82e704"
			} ],
			"performer" : {
				"identifiers" : [ {
					"identifier" : "2.16.840.1.113883.19.5.9999.456",
					"extension" : "2981823"
				} ],
				"address" : [ {
					"street_lines" : [ pd.address ],
					"city" : pd.city,
					"state" : pd.state,
					"zip" : pd.zip,
					"country" : "US"
				} ],
				"organization" : [ {
					"identifiers" : [ {
						"identifier" : "2.16.840.1.113883.19.5.9999.1393"
					} ],
					"name" : [ pd.performer_name ]
				} ]
			}
		}
	};
}

function populateEncounter(pd) {
	return {
		"encounter" : {
			"name" : pd.encounter_procedures ? pd.encounter_procedures.procedures.text : 'NI',
			"code" : pd.encounter_procedures ? pd.encounter_procedures.procedures.code : 'NI',
			"code_system_name" : "CPT",
			"translations" : [ {
				"name" : "NI",
				"code" : "NI",
				"code_system_name" : "NI"
			} ]
		},
		"identifiers" : [ {
			"identifier" : pd.sha_extension
		} ],
		"date_time" : {
			"point" : {
				"date" : fDate(pd.date_formatted),
				"precision" : "second"
			}
		},
		"performers" : [ {
			"identifiers" : [ {
				"identifier" : pd.facility_sha_extension
			} ],
			"code" : [ {
				"name" : pd.physician_type,
				"code" : "NI",
				"code_system_name" : "SNOMED CT"
			} ]
		} ],
		"locations" : [ {
			"name" : pd.location,
			"location_type" : {
				"name" : pd.location_details,
				"code" : "NI",
				"code_system_name" : "HealthcareServiceLocation"
			},
			"address" : [ {
				"street_lines" : [ pd.facility_address ],
				"city" : pd.facility_city,
				"state" : pd.facility_state,
				"zip" : pd.facility_zip,
				"country" : pd.facility_country
			} ]
		} ],
		"findings" : [ {
			"identifiers" : [ {
				"identifier" : "",
				"extension" : ""
			} ],
			"value" : {
				"name" : pd.encounter_reason,
				"code" : "NI",
				"code_system_name" : "SNOMED CT"
			},
			"date_time" : {
				"low" : {
					"date" : fDate(pd.date_formatted),
					"precision" : "day"
				}
			}
		} ]
	};
}

function populateAllergy(pd) {
	return {
		"identifiers" : [ {
			"identifier" : "36e3e930-7b14-11db-9fe1-0800200c9a66"
		} ],
		"date_time" : {
			"point" : {
				"date" : fDate(pd.startdate),
				"precision" : "day"
			}
		},
		"observation" : {
			"identifiers" : [ {
				"identifier" : "4adc1020-7b14-11db-9fe1-0800200c9a66"
			} ],
			"allergen" : {
				"name" : pd.title,
				"code" : pd.rxnorm_code,
				"code_system_name" : "RXNORM"
			},
			"intolerance" : {
				"name" : "Propensity to adverse reactions to drug",
				"code" : pd.snomed_code,
				"code_system_name" : "SNOMED CT"
			},
			"date_time" : {
				"low" : {
					"date" : fDate(pd.startdate),
					"precision" : "day"
				}
			},
			"status" : {
				"name" : pd.allergy_status,
				"code" : pd.status_code,
				"code_system_name" : "SNOMED CT"
			},
			"reactions" : [ {
				"identifiers" : [ {
					"identifier" : "4adc1020-7b14-11db-9fe1-0800200c9a64"
				} ],
				"date_time" : {
					"low" : {
						"date" : fDate(pd.startdate),
						"precision" : "day"
					},
					"high" : {
						"date" : fDate(pd.enddate),
						"precision" : "day"
					}
				},
				"reaction" : {
					"name" : pd.reaction_text,
					"code" : pd.reaction_code,
					"code_system_name" : "SNOMED CT"
				},
				"severity" : {
					"code" : {
						"name" : pd.outcome,
						"code" : pd.outcome_code,
						"code_system_name" : "SNOMED CT"
					},
					"interpretation" : {
						"name" : "UNK",
						"code" : "NI",
						"code_system_name" : "Observation Interpretation"
					}
				}
			} ],
			"severity" : {
				"code" : {
					"name" : pd.outcome,
					"code" : pd.outcome_code,
					"code_system_name" : "SNOMED CT"
				},
				"interpretation" : {
					"name" : "UNK",
					"code" : "NI",
					"code_system_name" : "Observation Interpretation"
				}
			}
		}
	};
}

function populateProblem(pd) {
	return {
		"date_time" : {
			"low" : {
				"date" : fDate(pd.start_date_table),
				"precision" : "day"
			},
			"high" : {
				"date" : fDate(pd.end_date),
				"precision" : "day"
			}
		},
		"identifiers" : [ {
			"identifier" : pd.sha_extension
		} ],
		"problem" : {
			"code" : {
				"name" : pd.title,
				"code" : pd.code,
				"code_system_name" : "ICD10"
			},
			"date_time" : {
				"low" : {
					"date" : fDate(pd.start_date_table),
					"precision" : "day"
				},
				"high" : {
					"date" : fDate(pd.end_date),
					"precision" : "second"
				}
			}
		},
		"onset_age" : pd.age,
		"onset_age_unit" : "Year",
		"status" : {
			"name" : pd.status_table,
			"date_time" : {
				"low" : {
					"date" : fDate(pd.start_date_table),
					"precision" : "day"
				},
				"high" : {
					"date" : fDate(pd.end_date),
					"precision" : "second"
				}
			}
		},
		"patient_status" : pd.observation,
		"source_list_identifiers" : [ {
			"identifier" : "ec8a6ff8-ed4b-4f7e-82c3-e98e58b45de7"
		} ]
	};

}

function populateProcedure(pd) {
	return {
		"procedure" : {
			"name" : pd.description,
			"code" : pd.code,
			"code_system_name" : "CPT"
		},
		"identifiers" : [ {
			"identifier" : "d68b7e32-7810-4f5b-9cc2-acd54b0fd85d"
		} ],
		"status" : "",
		"date_time" : {
			"point" : {
				"date" : fDate(pd.date),
				"precision" : "day"
			}
		},
		"body_sites" : [ {
			"name" : "",
			"code" : "",
			"code_system_name" : ""
		} ],
		"specimen" : {
			"identifiers" : [ {
				"identifier" : "c2ee9ee9-ae31-4628-a919-fec1cbb58683"
			} ],
			"code" : {
				"name" : "",
				"code" : "",
				"code_system_name" : "SNOMED CT"
			}
		},
		"performers" : [ {
			"identifiers" : [ {
				"identifier" : "2.16.840.1.113883.19.5.9999.456",
				"extension" : "2981823"
			} ],
			"address" : [ {
				"street_lines" : [ pd.address ],
				"city" : pd.city,
				"state" : pd.state,
				"zip" : pd.zip,
				"country" : "NI"
			} ],
			"phone" : [ {
				"number" : pd.work_phone,
				"type" : "work place"
			} ],
			"organization" : [ {
				"identifiers" : [ {
					"identifier" : "2.16.840.1.113883.19.5.9999.1393"
				} ],
				"name" : [ pd.facility_name ],
				"address" : [ {
					"street_lines" : [ pd.facility_address ],
					"city" : pd.facility_city,
					"state" : pd.facility_state,
					"zip" : pd.facility_zip,
					"country" : pd.facility_country
				} ],
				"phone" : [ {
					"number" : pd.facility_phone,
					"type" : "work place"
				} ]
			} ]
		} ],
		"procedure_type" : "procedure"
	};
}

function populateResult(pd) {
	return {
		"identifiers" : [ {
			"identifier" : "107c2dc0-67a5-11db-bd13-0800200c9a66"
		} ],
		"result" : {
			"name" : pd.title,
			"code" : pd.test_code || "NI",
			"code_system_name" : "LOINC"
		},
		"date_time" : {
			"point" : {
				"date" : fDate(pd.date_ordered_table),
				"precision" : "day"
			}
		},
		"status" : pd.order_status,
		"reference_range" : {
			"low" : pd.subtest.range,
			"high" : pd.subtest.range,
			"unit" : pd.subtest.unit
		},
		"interpretations" : [ pd.subtest.result_value ],
		"value" : parseFloat(pd.subtest.result_value),
		"unit" : pd.subtest.unit
	};
}

function getResultSet(results) {
	var resultSet = {
		"identifiers" : [ {
			"identifier" : "7d5a02b0-67a4-11db-bd13-0800200c9a66"
		} ],
		"result_set" : {
			"name" : "Get this data.",
			"code" : "NI",
			"code_system_name" : "SNOMED CT"
		}
	};
	var rs = [];
	var many = [];
	var theone = {};
	var count = 0;
	many.results = [];
	try{
		count = isOne(results.result);
	}catch(e){count = 0;}	
	if (count > 1) {
		for ( var i in results.result) {
			theone[i] = populateResult(results.result[i]);
			many.results.push(theone[i]);
		}
	} else if (count !== 0) {
		theone = populateResult(results.result);
		many.results.push(theone);
	}
	rs.results = Object.assign(resultSet);
	rs.results.results = Object.assign(many.results);
	return rs;
}

function getPlanOfCare(pd) {
	return {
		"plan" : {
			"name" : pd.code_text,
			"code" : pd.code,
			"code_system_name" : "SNOMED CT"
		},
		"identifiers" : [ {
			"identifier" : "9a6d1bac-17d3-4195-89a4-1121bc809b4a"
		} ],
		"date_time" : {
			"center" : {
				"date" : fDate(pd.date),
				"precision" : "day"
			}
		},
		"type" : "observation",
		"status" : {
			"code" : pd.status
		},
		"subType" : pd.description
	};
}

function populateVital(pd) {
	return [ {
		"identifiers" : [ {
			"identifier" : "2.16.840.1.113883.3.140.1.0.6.10.14.1",
			"extension" : pd.extension_bps
		} ],
		"vital" : {
			"name" : "Blood Pressure Systolic",
			"code" : "8480-6",
			"code_system_name" : "LOINC"
		},
		"status" : "completed",
		"date_time" : {
			"point" : {
				"date" : fDate(pd.effectivetime),
				"precision" : "second"
			}
		},
		"value" : parseFloat(pd.bps),
		"unit" : "mm[Hg]"
	}, {
		"identifiers" : [ {
			"identifier" : "2.16.840.1.113883.3.140.1.0.6.10.14.1",
			"extension" : pd.extension_bpd
		} ],
		"vital" : {
			"name" : "Blood Pressure Diastolic",
			"code" : "8462-4",
			"code_system_name" : "LOINC"
		},
		"status" : "completed",
		"date_time" : {
			"point" : {
				"date" : fDate(pd.effectivetime),
				"precision" : "second"
			}
		},
		"interpretations" : [ "UNK" ],
		"value" : parseFloat(pd.bpd),
		"unit" : "mm[Hg]"
	}, {
		"identifiers" : [ {
			"identifier" : "2.16.840.1.113883.3.140.1.0.6.10.14.1",
			"extension" : pd.extension_pulse
		} ],
		"vital" : {
			"name" : "Heart Rate",
			"code" : "8867-4",
			"code_system_name" : "LOINC"
		},
		"status" : "completed",
		"date_time" : {
			"point" : {
				"date" : fDate(pd.effectivetime),
				"precision" : "second"
			}
		},
		"interpretations" : [ "UNK" ],
		"value" : parseFloat(pd.pulse),
		"unit" : "/min"
	}, {
		"identifiers" : [ {
			"identifier" : "2.16.840.1.113883.3.140.1.0.6.10.14.1",
			"extension" : pd.extension_breath
		} ],
		"vital" : {
			"name" : "Respiratory Rate",
			"code" : "9279-1",
			"code_system_name" : "LOINC"
		},
		"status" : "completed",
		"date_time" : {
			"point" : {
				"date" : fDate(pd.effectivetime),
				"precision" : "second"
			}
		},
		"interpretations" : [ "UNK" ],
		"value" : parseFloat(pd.breath),
		"unit" : "/min"
	}, {
		"identifiers" : [ {
			"identifier" : "2.16.840.1.113883.3.140.1.0.6.10.14.1",
			"extension" : pd.extension_temperature
		} ],
		"vital" : {
			"name" : "Body Temperature",
			"code" : "8310-5",
			"code_system_name" : "LOINC"
		},
		"status" : "completed",
		"date_time" : {
			"point" : {
				"date" : fDate(pd.effectivetime),
				"precision" : "second"
			}
		},
		"interpretations" : [ "UNK" ],
		"value" : parseFloat(pd.temperature),
		"unit" : "degF"
	}, {
		"identifiers" : [ {
			"identifier" : "2.16.840.1.113883.3.140.1.0.6.10.14.1",
			"extension" : pd.extension_height
		} ],
		"vital" : {
			"name" : "Height",
			"code" : "8302-2",
			"code_system_name" : "LOINC"
		},
		"status" : "completed",
		"date_time" : {
			"point" : {
				"date" : fDate(pd.effectivetime),
				"precision" : "second"
			}
		},
		"interpretations" : [ "UNK" ],
		"value" : parseFloat(pd.height),
		"unit" : pd.unit_height
	}, {
		"identifiers" : [ {
			"identifier" : "2.16.840.1.113883.3.140.1.0.6.10.14.1",
			"extension" : pd.extension_weight
		} ],
		"vital" : {
			"name" : "Weight Measured",
			"code" : "3141-9",
			"code_system_name" : "LOINC"
		},
		"status" : "completed",
		"date_time" : {
			"point" : {
				"date" : fDate(pd.effectivetime),
				"precision" : "second"
			}
		},
		"interpretations" : [ "UNK" ],
		"value" : parseFloat(pd.weight),
		"unit" : pd.unit_weight
	}, {
		"identifiers" : [ {
			"identifier" : "2.16.840.1.113883.3.140.1.0.6.10.14.1",
			"extension" : pd.extension_BMI
		} ],
		"vital" : {
			"name" : "BMI (Body Mass Index)",
			"code" : "39156-5",
			"code_system_name" : "LOINC"
		},
		"status" : "completed",
		"date_time" : {
			"point" : {
				"date" : fDate(pd.effectivetime),
				"precision" : "second"
			}
		},
		"interpretations" : [ "UNK" ],
		"value" : parseFloat(pd.BMI),
		"unit" : "kg/m2"
	} ];
}

function populateSocialHistory(pd) {
	return {
		"date_time" : {
			"low" : {
				"date" : fDate(pd.date),
				"precision" : "day"
			},
			"high" : {
				"date" : fDate(pd.date),
				"precision" : "second"
			}
		},
		"identifiers" : [ {
			"identifier" : pd.sha_extension,
			"extension" : pd.extension
		} ],
		"code" : {
			"name" : pd.element
		},
		"value" : pd.description
	};
}

function populateImmunization(pd) {
	return {
		"date_time" : {
			"point" : {
				"date" : fDate(pd.administered_on),
				"precision" : "month"
			}
		},
		"identifiers" : [ {
			"identifier" : "e6f1ba43-c0ed-4b9b-9f12-f435d8ad8f92"
		} ],
		"status" : "complete",
		"product" : {
			"product" : {
				"name" : pd.code_text,
				"code" : pd.cvx_code,
				"code_system_name" : "CVX",
				"translations" : [ {
					"name" : "NI",
					"code" : "NI",
					"code_system_name" : "CVX"
				} ]
			},
			"lot_number" : "1",
			"manufacturer" : "UNK"
		},
		"administration" : {
			"route" : {
				"name" : pd.route_of_administration,
				"code" : pd.route_code,
				"code_system_name" : "Medication Route FDA"
			},
			"dose" : {
				"value" : 50,
				"unit" : "mcg"
			}
		},
		"performer" : {
			"identifiers" : [ {
				"identifier" : "2.16.840.1.113883.19.5.9999.456",
				"extension" : "2981824"
			} ],
			"name" : [ {
				"last" : pd.lname,
				"first" : pd.fname
			} ],
			"address" : [ {
				"street_lines" : [ pd.address ],
				"city" : pd.city,
				"state" : pd.state,
				"zip" : pd.zip,
				"country" : "US"
			} ],
			"organization" : [ {
				"identifiers" : [ {
					"identifier" : "2.16.840.1.113883.19.5.9999.1394"
				} ],
				"name" : [ pd.facility_name ]
			} ]
		},
		"instructions" : {
			"code" : {
				"name" : "immunization education",
				"code" : "171044003",
				"code_system_name" : "SNOMED CT"
			},
			"free_text" : "Needs Attention for more data."
		}
	};
}

function populatePayer(pd) {
	return {
		"identifiers" : [ {
			"identifier" : "1fe2cdd0-7aad-11db-9fe1-0800200c9a66"
		} ],
		"policy" : {
			"identifiers" : [ {
				"identifier" : "3e676a50-7aac-11db-9fe1-0800200c9a66"
			} ],
			"code" : {
				"code" : "SELF",
				"code_system_name" : "HL7 RoleCode"
			},
			"insurance" : {
				"code" : {
					"code" : "PAYOR",
					"code_system_name" : "HL7 RoleCode"
				},
				"performer" : {
					"identifiers" : [ {
						"identifier" : "2.16.840.1.113883.19"
					} ],
					"address" : [ {
						"street_lines" : [ "123 Insurance Road" ],
						"city" : "Blue Bell",
						"state" : "MA",
						"zip" : "02368",
						"country" : "US",
						"use" : "work place"
					} ],
					"phone" : [ {
						"number" : "(781)555-1515",
						"type" : "work place"
					} ],
					"organization" : [ {
						"name" : [ "Good Health Insurance" ],
						"address" : [ {
							"street_lines" : [ "123 Insurance Road" ],
							"city" : "Blue Bell",
							"state" : "MA",
							"zip" : "02368",
							"country" : "US",
							"use" : "work place"
						} ],
						"phone" : [ {
							"number" : "(781)555-1515",
							"type" : "work place"
						} ]
					} ],
					"code" : [ {
						"code" : "PAYOR",
						"code_system_name" : "HL7 RoleCode"
					} ]
				}
			}
		},
		"guarantor" : {
			"code" : {
				"code" : "GUAR",
				"code_system_name" : "HL7 Role"
			},
			"identifiers" : [ {
				"identifier" : "329fcdf0-7ab3-11db-9fe1-0800200c9a66"
			} ],
			"name" : [ {
				"prefix" : "Mr.",
				"middle" : [ "Frankie" ],
				"last" : "Everyman",
				"first" : "Adam"
			} ],
			"address" : [ {
				"street_lines" : [ "17 Daws Rd." ],
				"city" : "Blue Bell",
				"state" : "MA",
				"zip" : "02368",
				"country" : "US",
				"use" : "primary home"
			} ],
			"phone" : [ {
				"number" : "(781)555-1212",
				"type" : "primary home"
			} ]
		},
		"participant" : {
			"code" : {
				"name" : "Self",
				"code" : "SELF",
				"code_system_name" : "HL7 Role"
			},
			"performer" : {
				"identifiers" : [ {
					"identifier" : "14d4a520-7aae-11db-9fe1-0800200c9a66",
					"extension" : "1138345"
				} ],
				"address" : [ {
					"street_lines" : [ "17 Daws Rd." ],
					"city" : "Blue Bell",
					"state" : "MA",
					"zip" : "02368",
					"country" : "US",
					"use" : "primary home"
				} ],
				"code" : [ {
					"name" : "Self",
					"code" : "SELF",
					"code_system_name" : "HL7 Role"
				} ]
			},
			"name" : [ {
				"prefix" : "Mr.",
				"middle" : [ "A." ],
				"last" : "Everyman",
				"first" : "Frank"
			} ]
		},
		"policy_holder" : {
			"performer" : {
				"identifiers" : [ {
					"identifier" : "2.16.840.1.113883.19",
					"extension" : "1138345"
				} ],
				"address" : [ {
					"street_lines" : [ "17 Daws Rd." ],
					"city" : "Blue Bell",
					"state" : "MA",
					"zip" : "02368",
					"country" : "US",
					"use" : "primary home"
				} ]
			}
		},
		"authorization" : {
			"identifiers" : [ {
				"identifier" : "f4dce790-8328-11db-9fe1-0800200c9a66"
			} ],
			"procedure" : {
				"code" : {
					"name" : "Colonoscopy",
					"code" : "73761001",
					"code_system_name" : "SNOMED CT"
				}
			}
		}
	};
}

function populateHeader(pd){
	var head = {
            "identifiers": [
                {
                    "identifier": "2.16.840.1.113883.19.5.99999.1",
                    "extension": "TT988"
                }
            ],
            "confidentiality_code": {
                "code": "N",
                "name": "Normal",
                "code_system_name": "Confidentiality Code"
            },
            "code": {
                "name": "Continuity of Care Document",
                "code": "34133-9",
                "code_system_name": "LOINC"
            },
            "template": [
                "2.16.840.1.113883.10.20.22.1.1",
                "2.16.840.1.113883.10.20.22.1.2"
            ],
            "title": "Clinical: Health Summary",
            "date_time": {
                "point": {
                    "date": pd.created_time_timezone,
                    "precision": "minute"
                }
            },
            "author": {
                "author": [
                    {
                        "identifiers": [
                            {
                                "identifier": "2.16.840.1.113883.4.6",
                                "extension": "99999999"
                            }
                        ],
                        "name": [
                            {
                                "last": pd.author.lname,
                                "first": pd.author.fname
                            }
                        ],
                        "address": [
                            {
                                "street_lines": [
                                	pd.author.streetAddressLine
                                ],
                                "city": pd.author.city,
                                "state": pd.author.state,
                                "zip": pd.author.postalCode,
                                "country": pd.author.country
                            }
                        ],
                        "phone": [
                            {
                                "number": pd.author.telecom,
                                "type": "work place"
                            }
                        ],
                        "code": [
                            {
                                "name": "UNK",
                                "code": "NI"
                            }
                        ]
                    }
                ],
                "date_time": {
                    "point": {
                        "date": "UNK",
                        "precision": "second"
                    }
                }
            },
            "data_enterer": {
                "identifiers": [
                    {
                        "identifier": "2.16.840.1.113883.4.6",
                        "extension": "999999943252"
                    }
                ],
                "name": [
                    {
                        "last": pd.data_enterer.lname,
                        "first": pd.data_enterer.fname
                    }
                ],
                "address": [
                	{
                        "street_lines": [
                        	pd.data_enterer.streetAddressLine
                        ],
                        "city": pd.data_enterer.city,
                        "state": pd.data_enterer.state,
                        "zip": pd.data_enterer.postalCode,
                        "country": pd.data_enterer.country
                    }
                ],
                "phone": [
                    {
                        "number": pd.data_enterer.telecom,
                        "type": "work place"
                    }
                ]
            },
            "informant": {
                "identifiers": [
                    {
                        "identifier": "2.16.840.1.113883.19.5",
                        "extension": "KP00017"
                    }
                ],
                "name": [
                    {
                        "last": pd.informer.lname,
                        "first": pd.informer.fname
                    }
                ],
                "address": [
                	{
                        "street_lines": [
                        	pd.informer.streetAddressLine
                        ],
                        "city": pd.informer.city,
                        "state": pd.informer.state,
                        "zip": pd.informer.postalCode,
                        "country": pd.informer.country
                    }
                ],
                "phone": [
                    {
                        "number": pd.informer.telecom,
                        "type": "work place"
                    }
                ]
            },
            "service_event": {
                "code": {
                    "name": "NI",
                    "code": "NI",
                    "code_system_name": "SNOMED CT"
                },
                "date_time": {
                    "low": {
                        "date": "UNK",
                        "precision": "minute"
                    },
                    "high": {
                        "date": pd.created_time_timezone,
                        "precision": "minute"
                    }
                },
                "performer": [
                    {
                        "performer": [
                            {
                                "identifiers": [
                                    {
                                        "identifier": "2.16.840.1.113883.4.6",
                                        "extension": "PseudoMD-1"
                                    }
                                ],
                                "name": [ // Most likely not right - maybe should be provider
                                    {
                                        "last": pd.information_recipient.lname,
                                        "first": pd.information_recipient.fname
                                    }
                                ],
                                "address": [
                                    {
                                        "street_lines": [
                                        	pd.information_recipient.streetAddressLine
                                        ],
                                        "city": pd.information_recipient.city,
                                        "state": pd.information_recipient.state,
                                        "zip": pd.information_recipient.postalCode,
                                        "country": pd.information_recipient.country
                                    }
                                ],
                                "phone": [
                                    {
                                        "number": pd.information_recipient.telecom,
                                        "type": "work place"
                                    }
                                ],
                                "organization": [
                                    {
                                        "identifiers": [
                                            {
                                                "identifier": "2.16.840.1.113883.19.5.9999.1393"
                                            }
                                        ],
                                        "name": [
                                        	pd.encounter_provider.facility_name
                                        ],
                                        "address": [
                                            {
                                                "street_lines": [
                                                   pd.encounter_provider.facility_street
                                                ],
                                                "city": pd.encounter_provider.facility_city,
                                                "state": pd.encounter_provider.facility_state,
                                                "zip": pd.encounter_provider.facility_postal_code,
                                                "country": pd.encounter_provider.facility_country_code
                                            }
                                        ],
                                        "phone": [
                                            {
                                                "number": pd.encounter_provider.facility_phone,
                                                "type": "primary work"
                                            }
                                        ]
                                    }
                                ],
                                "code": [
                                    {
                                        "name": "UNK",
                                        "code": "NI",
                                        "code_system_name": "Provider Codes"
                                    }
                                ]
                            }
                        ],
                        "code": {
                            "name": "Primary Performer",
                            "code": "PP",
                            "code_system_name": "Provider Role"
                        }
                    }
                ]
            }
        };
	return head;
}

function genCcda(pd) {
	var doc = {};
	var data = {};
	var count = 0;
	var many = [];
	var theone = {};
	
	// Header -  @todo pd may be too large- break down to subsections
	var head = populateHeader(pd);
	data.head = Object.assign(head);
	// Demographics
	var demographic = populateDemographic(pd.patient, pd.guardian);
	data.demographics = Object.assign(demographic);
	// vitals
	many.vitals = [];
	try{
		count = isOne(pd.history_physical.vitals_list.vitals);
	}catch(e){count = 0}
	if (count > 1) {
		for ( var i in pd.history_physical.vitals_list.vitals) {
			theone = populateVital(pd.history_physical.vitals_list.vitals[i]);
			many.vitals.push.apply(many.vitals, theone);
		}
	} else if (count === 1) {
		theone = populateVital(pd.history_physical.vitals_list.vitals);
		many.vitals.push(theone);
	}
	data.vitals = Object.assign(many.vitals);
	// Medications
	var meds = [];
	var m = {};
	meds.medications = [];
	try{
		count = isOne(pd.medications.medication);
	}catch(e){count = 0}	
	if (count > 1) {
		for ( var i in pd.medications.medication) {
			m[i] = populateMedication(pd.medications.medication[i]);
			meds.medications.push(m[i]);
		}
	} else if (count !== 0) {
		m = populateMedication(pd.medications.medication);
		meds.medications.push(m);
	}
	data.medications = Object.assign(meds.medications);
	// Encounters
	var encs = [];
	var enc = {};
	encs.encounters = [];
	try{
		count = isOne(pd.encounter_list.encounter);
	}catch(e){count = 0}	
	if (count > 1) {
		for ( var i in pd.encounter_list.encounter) {
			enc[i] = populateEncounter(pd.encounter_list.encounter[i]);
			encs.encounters.push(enc[i]);
		}
	} else if (count !== 0) {
		enc = populateEncounter(pd.encounter_list.encounter);
		encs.encounters.push(enc);
	}
	data.encounters = Object.assign(encs.encounters);
	// Allergies
	var allergies = [];
	var allergy = {};
	allergies.allergies = [];
	try{
		count = isOne(pd.allergies.allergy);
	}catch(e){count = 0}
	if (count > 1) {
		for ( var i in pd.allergies.allergy) {
			allergy[i] = populateAllergy(pd.allergies.allergy[i]);
			allergies.allergies.push(allergy[i]);
		}
	} else if (count !== 0) {
		allergy = populateAllergy(pd.allergies.allergy);
		allergies.allergies.push(allergy);
	}
	data.allergies = Object.assign(allergies.allergies);
	// Problems
	var problems = [];
	var problem = {};
	problems.problems = [];
	try{
		count = isOne(pd.problem_lists.problem);
	}catch(e){count = 0}
	if (count > 1) {
		for ( var i in pd.problem_lists.problem) {
			problem[i] = populateProblem(pd.problem_lists.problem[i]);
			problems.problems.push(problem[i]);
		}
	} else if (count !== 0) {
		problem = populateProblem(pd.problem_lists.problem);
		problems.problems.push(problem);
	}
	data.problems = Object.assign(problems.problems);
	// Procedures
	many = [];
	theone = {};
	many.procedures = [];
	try{
		count = isOne(pd.procedures.procedure);
	}catch(e){count = 0}
	if (count > 1) {
		for ( var i in pd.procedures.procedure) {
			theone[i] = populateProcedure(pd.procedures.procedure[i]);
			many.procedures.push(theone[i]);
		}
	} else if (count !== 0) {
		theone = populateProcedure(pd.procedures.procedure);
		many.procedures.push(theone);
	}
	data.procedures = Object.assign(many.procedures);
	// Results
	data.results = Object.assign(getResultSet(pd.results)['results']);
	// Immunizations
	many = [];
	theone = {};
	many.immunizations = [];
	try{
		count = isOne(pd.immunizations.immunization);
	}catch(e){count = 0;}
	if (count > 1) {
		for ( var i in pd.immunizations.immunization) {
			theone[i] = populateImmunization(pd.immunizations.immunization[i]);
			many.immunizations.push(theone[i]);
		}
	} else if (count !== 0) {
		theone = populateImmunization(pd.immunizations.immunization);
		many.immunizations.push(theone);
	}
	data.immunizations = Object.assign(many.immunizations);
	// Plan of Care
	many = [];
	theone = {};
	many.plan_of_care = [];
	try{
		count = isOne(pd.planofcare); // ccm doesn't send array of items
	}catch(e){count = 0}
	if (count > 1) {
		for ( var i in pd.planofcare.item) {
			theone[i] = getPlanOfCare(pd.planofcare.item[i]);
			many.plan_of_care.push(theone[i]);
		}
	} else if (count !== 0) {
		theone = getPlanOfCare(pd.planofcare.item);
		many.plan_of_care.push(theone);
	}
	data.plan_of_care = Object.assign(many.plan_of_care);
	// Social History
	many = [];
	theone = {};
	many.social_history = [];
	try{
		count = isOne(pd.history_physical.social_history.history_element);
	}catch(e){count = 0}
	if (count > 1) {
		for ( var i in pd.history_physical.social_history.history_element) {
			theone[i] = populateSocialHistory(pd.history_physical.social_history.history_element[i]);
			many.social_history.push(theone[i]);
		}
	} else if (count !== 0) {
		theone = populateSocialHistory(pd.history_physical.social_history.history_element);
		many.social_history.push(theone);
	}
	data.social_history = Object.assign(many.social_history);

	// ------------------------------------------ End Sections -------------------------------------------------//

	doc.data = Object.assign(data);

	var xml = bbg.generateCCD(doc);
	//console.log(xml)
	return xml;
}

function processConnection( connection ) {
	conn = connection; // make it global
	var remoteAddress = conn.remoteAddress + ':' + conn.remotePort;
	console.log(remoteAddress);
	conn.setEncoding('utf8');
	function eventData(xml) {
		xml = xml.replace(/(\u000b|\u001c)/gm, "").trim();
		// Sanity check from service manager
		if (xml === 'status' || xml.length < 80) {
			conn.write("statusok" + String.fromCharCode(28) + "\r\r");
			conn.end('');
			return;
		}
		var doc = "";
		to_json(xml, function(error, data) {
			// console.log(JSON.stringify(data, null, 4));
			if (error) { // need try catch
				console.log(error);
				return;
			}
			doc = genCcda( data.CCDA );
		});
		doc = headReplace(doc);
		doc = doc.toString().replace(/(\u000b|\u001c|\r)/gm, "").trim();
		//console.log(doc)
		// var justuwait = new Date(new Date().getTime() + 1 * 1000);
		// while(justuwait > new Date()){}
		// Document length is anywhere from 50k to 125K so lets not flood poor ole php's socket buffer
		// not really throttled though...
		var chunk = "";
		var numChunks = Math.ceil(doc.length / 1024);
		for (var i = 0, o = 0; i < numChunks; ++i, o += 1024) {
			chunk = doc.substr(o, 1024);
			conn.write(chunk);
		}
		// Php is sensitive to ending read stream and CCM chops last three bytes
		// empty string ends read and char 28 is xfer end (php doesn't care but CCM used so, I will also).
		conn.write(String.fromCharCode(28) + "\r\r" + '');
		conn.end();
		/*By parsing doc just created we can see any nullFlavors or missing parts
		console.log("total=" + conn.bytesWritten);
		remove for production - test validation of doc just created
		var data = bb.parse(doc);
		console.log(JSON.stringify(data.errors, null, 4));*/
	}
	function eventCloseConn() {
		//console.log('connection from %s closed', remoteAddress);
	}
	function eventErrorConn(err) {
		//console.log('Connection %s error: %s', remoteAddress, err.message);
	}
	// Connection Events //
	conn.on('data', eventData);
	conn.once('close', eventCloseConn);
	conn.on('error', eventErrorConn);
}
function setUp(server) {
	server.on('connection', processConnection);
	server.listen(6661, 'localhost', function() {
		//console.log('server listening to %j', server.address());
	});
}
setUp(server);